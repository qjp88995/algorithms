import { findEdge, tracePath } from '@/lib/graph/model';
import { MinHeap } from '@/lib/min-heap';

import { exactDistances, hasNegativeCycle } from './reference';
import type { ShortestScene } from './scene';
import type { ShortestAlgorithm, ShortestStats } from './types';

/** 浮点比较的容差；权重都是整数，这里纯粹是防止累加误差造成假松弛 */
const EPS = 1e-9;

/**
 * 加权图最短路的可单步内核。
 *
 * 三个算法都归结成同一个动作 —— **松弛一条边**：
 * 「如果绕道 u 再走这条边比现在记录的更近，就改小它」。
 * 区别只在检查顺序，以及由此得到的保证：
 *
 *   Dijkstra        按当前距离从小到大挑节点，挑中即定稿。
 *                   定稿的前提是"以后的路只会更贵"，也就是边权非负。
 *   Bellman-Ford    不挑，把所有边轮着松弛 V−1 轮 —— 最短路最多 V−1 条边，
 *                   第 k 轮之后所有"用 k 条边能走到"的距离都已正确。
 *                   第 V 轮还能松弛，说明有一个越绕越便宜的环。
 *   Floyd-Warshall  换个维度递推：只允许中转前 k 个点时，i 到 j 最短是多少。
 *                   k 从 0 加到 V，就填满了全源距离表。
 *
 * 内核不碰 canvas、不碰 React。它对外暴露的 `activeEdge` / `pivot` /
 * `cursor` 不是算法必需的状态，而是"这一拍在看哪里" —— 画布靠它们
 * 把抽象的循环变量画成图上的高亮。
 */
export class ShortestPathRun {
  readonly scene: ShortestScene;
  readonly algorithm: ShortestAlgorithm;
  readonly source: number;
  readonly target: number;
  readonly count: number;

  /** 起点到各节点的当前距离。三个算法共用这一份展示口径 */
  readonly dist: Float64Array;
  /** 最短路树的父指针 */
  readonly parent: Int32Array;
  /** Dijkstra 已出队定稿的节点 */
  readonly settled: Uint8Array;

  /** 这一拍正在检查的边；-1 表示没有对应的实际边 */
  activeEdge = -1;
  /** 这一拍的松弛是否成功把距离改小了 */
  activeImproved = false;
  /** Dijkstra 正在展开的节点 / Floyd 的行 i；-1 表示无 */
  cursor = -1;
  /** Floyd 的中转点 k；其余算法恒为 -1 */
  pivot = -1;
  /** Floyd 的列 j；其余算法恒为 -1 */
  column = -1;
  /** 检测到的负环（节点序列，首尾相接）；空表示没有 */
  negativeCycleNodes: number[] = [];

  private checks = 0;
  private improvements = 0;
  private finished = false;

  // ─── Dijkstra ───
  private readonly heap = new MinHeap();
  private sequence = 0;
  private edgeCursor = 0;
  private settledCount = 0;

  // ─── Bellman-Ford ───
  private pass = 0;
  private edgeIndex = 0;
  private changedThisPass = false;
  private detecting = false;

  // ─── Floyd-Warshall ───
  private readonly matrix: Float64Array;
  private readonly pred: Int32Array;
  private k = 0;
  private row = 0;
  private col = 0;

  /** 图里本来就有负环 —— 有的话"答案对不对"这个问题本身就没意义了 */
  private readonly cyclic: boolean;
  private reference: Float64Array | null = null;

  constructor(
    scene: ShortestScene,
    algorithm: ShortestAlgorithm,
    source: number,
    target: number
  ) {
    this.scene = scene;
    this.algorithm = algorithm;
    this.source = source;
    this.target = target;
    this.count = scene.graph.nodes.length;

    this.dist = new Float64Array(this.count).fill(Infinity);
    this.parent = new Int32Array(this.count).fill(-1);
    this.settled = new Uint8Array(this.count);
    this.cyclic = hasNegativeCycle(scene.graph, scene.weights);

    if (algorithm === 'floyd-warshall') {
      const size = this.count * this.count;
      this.matrix = new Float64Array(size).fill(Infinity);
      this.pred = new Int32Array(size).fill(-1);
      for (let v = 0; v < this.count; v++) this.matrix[v * this.count + v] = 0;
      scene.graph.edges.forEach((edge, index) => {
        const cell = edge.from * this.count + edge.to;
        if (scene.weights[index] < this.matrix[cell]) {
          this.matrix[cell] = scene.weights[index];
          this.pred[cell] = edge.from;
        }
      });
      this.syncRow();
    } else {
      this.matrix = new Float64Array(0);
      this.pred = new Int32Array(0);
      this.dist[source] = 0;
      if (algorithm === 'dijkstra') {
        this.heap.push(0, this.sequence++, source);
      }
    }
  }

  get done() {
    return this.finished;
  }

  /** 展开一次「看一条边」，返回是否已经结束 */
  step(): boolean {
    if (this.finished) return true;
    switch (this.algorithm) {
      case 'dijkstra':
        return this.stepDijkstra();
      case 'bellman-ford':
        return this.stepBellmanFord();
      case 'floyd-warshall':
        return this.stepFloyd();
    }
  }

  advance(steps: number) {
    let taken = 0;
    while (taken < steps && !this.finished) {
      this.step();
      taken++;
    }
    return taken;
  }

  runToEnd() {
    const limit =
      this.count ** 3 + this.count * this.scene.graph.edges.length * 2 + 64;
    let guard = 0;
    while (!this.finished && guard++ < limit) this.step();
  }

  /** 起点到终点的节点序列；不可达或父指针成环时为空 */
  path(): number[] {
    if (!Number.isFinite(this.dist[this.target])) return [];
    return tracePath(this.parent, this.source, this.target);
  }

  stats(): ShortestStats {
    const path = this.path();
    return {
      checks: this.checks,
      improvements: this.improvements,
      round: this.currentRound(),
      totalRounds: this.totalRounds(),
      done: this.finished,
      reached: Number.isFinite(this.dist[this.target]),
      distance: this.dist[this.target],
      hops: Math.max(0, path.length - 1),
      negativeCycle: this.negativeCycleNodes.length > 0,
      wrong: this.wrongCount(),
    };
  }

  // ─── Dijkstra ─────────────────────────────────────────────
  private stepDijkstra(): boolean {
    const { graph, weights } = this.scene;

    // 当前节点还有出边没看完，就先看边 —— 一拍一条，看得清
    if (
      this.cursor >= 0 &&
      this.edgeCursor < graph.outgoing[this.cursor].length
    ) {
      const edge = graph.outgoing[this.cursor][this.edgeCursor++];
      const { from, to } = graph.edges[edge];
      this.activeEdge = edge;
      this.checks++;

      // 已定稿的节点不再改。负权下答错的根源就在这一行：
      // Dijkstra 赌的是"之后再也遇不到更便宜的路"
      if (this.settled[to]) {
        this.activeImproved = false;
        return false;
      }
      const candidate = this.dist[from] + weights[edge];
      if (candidate < this.dist[to] - EPS) {
        this.dist[to] = candidate;
        this.parent[to] = from;
        this.improvements++;
        this.activeImproved = true;
        // 惰性删除：不做 decrease-key，弹出时靠 settled 跳过过期条目
        this.heap.push(candidate, this.sequence++, to);
      } else {
        this.activeImproved = false;
      }
      return false;
    }

    // 出边看完了，取下一个距离最小的节点定稿
    this.activeEdge = -1;
    this.activeImproved = false;
    let next = -1;
    while (this.heap.size > 0) {
      const node = this.heap.pop();
      if (this.settled[node]) continue;
      next = node;
      break;
    }
    if (next < 0) {
      this.cursor = -1;
      this.finished = true;
      return true;
    }
    this.cursor = next;
    this.settled[next] = 1;
    this.settledCount++;
    this.edgeCursor = 0;
    return false;
  }

  // ─── Bellman-Ford ─────────────────────────────────────────
  private stepBellmanFord(): boolean {
    const { graph, weights } = this.scene;
    const edge = this.edgeIndex++;
    const { from, to } = graph.edges[edge];

    this.activeEdge = edge;
    this.cursor = from;
    this.checks++;

    const candidate = this.dist[from] + weights[edge];
    if (Number.isFinite(this.dist[from]) && candidate < this.dist[to] - EPS) {
      this.activeImproved = true;
      if (this.detecting) {
        // 第 V 轮还能松弛：只有"绕一圈变便宜"的环才做得到这件事
        this.negativeCycleNodes = this.traceCycle(to);
        this.finished = true;
        return true;
      }
      this.dist[to] = candidate;
      this.parent[to] = from;
      this.improvements++;
      this.changedThisPass = true;
    } else {
      this.activeImproved = false;
    }

    if (this.edgeIndex >= graph.edges.length) {
      this.edgeIndex = 0;
      this.pass++;
      if (!this.changedThisPass) {
        // 整整一轮没有任何改动 —— 距离表已是不动点，也就不可能有负环
        this.finished = true;
      } else if (this.detecting) {
        this.finished = true;
      } else if (this.pass >= this.count - 1) {
        this.detecting = true;
      }
      this.changedThisPass = false;
    }
    return this.finished;
  }

  /**
   * 从"还能被松弛的那个节点"倒推出环。
   *
   * 先沿父指针走 V 步 —— 走这么多步一定已经掉进环里了 ——
   * 再从那儿一直走到遇见重复节点，中间这一段就是环本身。
   */
  private traceCycle(from: number): number[] {
    let node = from;
    for (let i = 0; i < this.count; i++) {
      if (this.parent[node] < 0) return [];
      node = this.parent[node];
    }
    const chain: number[] = [];
    const seen = new Set<number>();
    let current = node;
    while (!seen.has(current)) {
      seen.add(current);
      chain.push(current);
      current = this.parent[current];
      if (current < 0) return [];
    }
    // 父指针是逆着走的，反过来相邻两项才是一条真实的边
    return chain.slice(chain.indexOf(current)).reverse();
  }

  // ─── Floyd-Warshall ───────────────────────────────────────
  private stepFloyd(): boolean {
    const n = this.count;
    const { graph } = this.scene;
    const i = this.row;
    const j = this.col;

    this.pivot = this.k;
    this.cursor = i;
    this.column = j;
    this.activeEdge = findEdge(graph, i, j);
    this.checks++;

    // 对角线（i === j）照样参与松弛：d[i][i] 被压到负数，
    // 正是"从 i 出发绕一圈回来更便宜"，也就是负环的定义
    const viaK = this.matrix[i * n + this.k] + this.matrix[this.k * n + j];
    if (viaK < this.matrix[i * n + j] - EPS) {
      this.matrix[i * n + j] = viaK;
      // 到 j 的最后一步跟着"k 怎么到 j"走
      this.pred[i * n + j] = this.pred[this.k * n + j];
      this.improvements++;
      this.activeImproved = true;
    } else {
      this.activeImproved = false;
    }

    if (++this.col >= n) {
      this.col = 0;
      if (++this.row >= n) {
        this.row = 0;
        this.k++;
      }
    }
    this.syncRow();

    if (this.k >= n) {
      this.finished = true;
      this.pivot = -1;
      this.column = -1;
      this.cursor = -1;
      this.activeEdge = -1;
      this.negativeCycleNodes = this.diagonalCycle();
    }
    return this.finished;
  }

  /** Floyd 把 `dist` 当成整张表里起点那一行的镜像，画布才不用分两套读法 */
  private syncRow() {
    const n = this.count;
    for (let v = 0; v < n; v++) {
      this.dist[v] = this.matrix[this.source * n + v];
      this.parent[v] = this.pred[this.source * n + v];
    }
  }

  /**
   * 对角线为负说明"从自己出发绕一圈回来更便宜"，即负环。
   *
   * 沿 pred 表从 v 往回走，走回 v 为止，中间经过的就是环上的点。
   * 负环污染过的 pred 未必构成一条干净的回路，所以走不回来时
   * 只标出 v 这一个点 —— 宁可少画，也不要画一串不存在的边。
   */
  private diagonalCycle(): number[] {
    const n = this.count;
    for (let v = 0; v < n; v++) {
      if (this.matrix[v * n + v] >= -EPS) continue;
      const chain: number[] = [];
      const seen = new Set<number>();
      let node = this.pred[v * n + v];
      while (node >= 0 && !seen.has(node)) {
        seen.add(node);
        chain.push(node);
        if (node === v) return chain.reverse();
        node = this.pred[v * n + node];
      }
      return [v];
    }
    return [];
  }

  // ─── 统计 ─────────────────────────────────────────────────
  private currentRound() {
    if (this.algorithm === 'dijkstra') return this.settledCount;
    if (this.algorithm === 'bellman-ford') return this.pass;
    return Math.min(this.k, this.count);
  }

  private totalRounds() {
    if (this.algorithm === 'dijkstra') return this.count;
    if (this.algorithm === 'bellman-ford') return this.count - 1;
    return this.count;
  }

  /**
   * 和精确解对不上的节点数。
   *
   * 只在跑完之后才有意义（跑的过程中距离本来就是暂定值），
   * 图里已经有负环时也不作数 —— 那时候"最短距离"根本不存在。
   */
  private wrongCount() {
    if (!this.finished || this.cyclic) return 0;
    this.reference ??= exactDistances(
      this.scene.graph,
      this.scene.weights,
      this.source
    );
    let wrong = 0;
    for (let v = 0; v < this.count; v++) {
      if (Math.abs(this.dist[v] - this.reference[v]) > 1e-6) wrong++;
    }
    return wrong;
  }

  /** 某个节点的距离是否与精确解不符，画布据此标红 */
  isWrong(node: number) {
    if (!this.finished || this.cyclic) return false;
    this.reference ??= exactDistances(
      this.scene.graph,
      this.scene.weights,
      this.source
    );
    return Math.abs(this.dist[node] - this.reference[node]) > 1e-6;
  }
}
