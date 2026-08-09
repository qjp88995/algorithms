import { DisjointSet } from '@/lib/disjoint-set';
import { MinHeap } from '@/lib/min-heap';

import { linkOf } from './reference';
import type { SpanningScene } from './scene';
import type { SpanningAlgorithm, SpanningStats } from './types';

/**
 * 最小生成树的可单步内核。
 *
 * 三个算法都是**贪心**，都在重复同一个动作 —— 考察一条边，决定收不收：
 *
 *   Kruskal   把全部边按权重排成一队，从头往下试。两端已经连通就丢掉
 *             （收了会成环），否则收下并合并两块。树是从碎片并起来的。
 *   Prim      从根开始只养一棵树，每次接上这棵树伸出去最便宜的那条边。
 *             不需要判环 —— 只要另一端还不在树里，接上就不会成环。
 *   Borůvka   所有分量并行：每轮各自挑一条最便宜的出边，然后一起接上。
 *             每轮分量数至少减半，所以只需要 log V 轮。
 *
 * 三个都对，靠的是同一条**割性质**：把点集任意分成两半，横跨这道口子
 * 的边里最便宜的那条，一定在某棵最小生成树上。Kruskal 的每一次「收下」、
 * Prim 的每一次「接上」、Borůvka 每轮的每一条选择，都是这条性质的一次应用。
 *
 * 内核不碰 canvas、不碰 React。对外暴露的 `activeEdge` / `activeRejected`
 * 之类不是算法必需的状态，而是「这一拍在看哪里」—— 画布靠它们把循环
 * 变量画成图上的高亮。
 */
export class SpanningTreeRun {
  readonly scene: SpanningScene;
  readonly algorithm: SpanningAlgorithm;
  readonly root: number;
  readonly count: number;

  /** 已经收进树里的边（无向代表下标） */
  readonly chosen: number[] = [];
  /** 收进树里的边，按下标查 —— 画布每帧要问很多次 */
  readonly inTree: Uint8Array;
  /** 考察过、又被丢掉的边。两端一旦连通就永远连通，所以这个标记不会撤销 */
  readonly discarded: Uint8Array;
  /** 节点是否已被这棵树覆盖（Prim 的「雪球」范围） */
  readonly covered: Uint8Array;

  /** 这一拍正在考察的边（代表下标）；-1 表示没有 */
  activeEdge = -1;
  /** 这一拍把它收进了树里 */
  activeAccepted = false;
  /** 这一拍把它丢掉了 —— 两端已经连通，收了会成环 */
  activeRejected = false;
  /** Borůvka 扫描时：这条边成了某个分量当前最便宜的出边 */
  activeCandidate = false;

  /** Borůvka 本轮各分量选中的最便宜出边，按分量代表索引；-1 为无 */
  readonly cheapest: Int32Array;

  private readonly dsu: DisjointSet;
  private checks = 0;
  private weight = 0;
  private finished = false;

  // ─── Kruskal ───
  private at = 0;

  // ─── Prim ───
  private readonly heap = new MinHeap();

  // ─── Borůvka ───
  private phase: 'scan' | 'merge' = 'scan';
  private scanIndex = 0;
  private merging: number[] = [];
  private mergeIndex = 0;
  private round = 0;

  constructor(
    scene: SpanningScene,
    algorithm: SpanningAlgorithm,
    root: number
  ) {
    this.scene = scene;
    this.algorithm = algorithm;
    this.root = root;
    this.count = scene.graph.nodes.length;

    this.dsu = new DisjointSet(this.count);
    this.inTree = new Uint8Array(scene.graph.edges.length);
    this.discarded = new Uint8Array(scene.graph.edges.length);
    this.covered = new Uint8Array(this.count);
    this.cheapest = new Int32Array(this.count).fill(-1);

    if (algorithm === 'prim') {
      this.covered[root] = 1;
      this.pushFrontier(root);
    }
  }

  get done() {
    return this.finished;
  }

  /** 展开一次「考察一条边」，返回是否已经结束 */
  step(): boolean {
    if (this.finished) return true;
    this.activeAccepted = false;
    this.activeRejected = false;
    this.activeCandidate = false;

    switch (this.algorithm) {
      case 'kruskal':
        return this.stepKruskal();
      case 'prim':
        return this.stepPrim();
      case 'boruvka':
        return this.stepBoruvka();
    }
  }

  runToEnd() {
    const limit = this.scene.links.length * (this.count + 2) + this.count * 4;
    let guard = 0;
    while (!this.finished && guard++ < limit + 64) this.step();
  }

  /** 节点所在分量的代表 —— 画布按它给分量上色 */
  componentOf(node: number) {
    return this.dsu.find(node);
  }

  stats(): SpanningStats {
    const needed = this.scene.reference.links.length;
    return {
      checks: this.checks,
      chosen: this.chosen.length,
      needed,
      weight: this.weight,
      components: this.dsu.count,
      round: this.algorithm === 'boruvka' ? this.round : 0,
      totalRounds:
        this.algorithm === 'boruvka'
          ? Math.max(1, Math.ceil(Math.log2(Math.max(this.count, 2))))
          : 0,
      done: this.finished,
      optimal:
        this.finished &&
        this.chosen.length === needed &&
        Math.abs(this.weight - this.scene.reference.weight) < 1e-9,
    };
  }

  // ─── Kruskal ──────────────────────────────────────────────
  private stepKruskal(): boolean {
    const links = this.scene.sortedLinks;
    if (this.at >= links.length) {
      this.activeEdge = -1;
      return this.finish();
    }

    const link = links[this.at++];
    this.activeEdge = link;
    this.checks++;
    this.take(link);

    // 收满 V−1 条就可以停了，后面的边不可能再收
    if (this.chosen.length >= this.count - 1) return this.finish();
    return false;
  }

  // ─── Prim ─────────────────────────────────────────────────
  private stepPrim(): boolean {
    // 堆空了就结束。图不连通时这里只长出根所在的那一块 ——
    // 另外两个算法会继续把其余分量各自长成一棵，得到一片森林
    if (this.heap.size === 0) {
      this.activeEdge = -1;
      return this.finish();
    }

    const edge = this.heap.pop();
    const { to } = this.scene.graph.edges[edge];
    this.activeEdge = linkOf(this.scene.graph, edge);
    this.checks++;

    // 惰性删除：入堆之后 to 才进树，这种过期条目直接跳过
    if (this.covered[to]) {
      this.reject(this.activeEdge);
      return false;
    }

    // 另一端还不在树里，接上必然不成环 —— take 里的合并一定成功
    this.take(this.activeEdge);
    this.pushFrontier(to);

    if (this.chosen.length >= this.count - 1) return this.finish();
    return false;
  }

  /** 把新入树节点的出边推进堆；已在树内的那一端不必再考虑 */
  private pushFrontier(node: number) {
    const { graph, weights } = this.scene;
    for (const edge of graph.outgoing[node]) {
      if (this.covered[graph.edges[edge].to]) continue;
      // tie-break 用无向代表下标，和 Kruskal 的排序键保持同一个全序，
      // 权重并列时两个算法才会挑中同一条边
      this.heap.push(weights[edge], linkOf(graph, edge), edge);
    }
  }

  // ─── Borůvka ──────────────────────────────────────────────
  private stepBoruvka(): boolean {
    return this.phase === 'scan' ? this.scanBoruvka() : this.mergeBoruvka();
  }

  /** 扫描阶段：过一遍所有边，替每个分量记住它最便宜的一条出边 */
  private scanBoruvka(): boolean {
    const { graph, weights, links } = this.scene;

    if (this.scanIndex >= links.length) {
      this.merging = this.collectCheapest();
      // 一整轮下来没有任何分量找得到出边：剩下的分量之间根本不相连
      if (this.merging.length === 0) {
        this.activeEdge = -1;
        return this.finish();
      }
      this.phase = 'merge';
      this.mergeIndex = 0;
      this.activeEdge = -1;
      return false;
    }

    const link = links[this.scanIndex++];
    const { from, to } = graph.edges[link];
    this.activeEdge = link;
    this.checks++;

    const rootA = this.dsu.find(from);
    const rootB = this.dsu.find(to);
    if (rootA === rootB) {
      // 两端已经在同一块里，这条边对谁都不是出边
      this.reject(link);
      return false;
    }

    for (const component of [rootA, rootB]) {
      if (this.better(link, this.cheapest[component], weights)) {
        this.cheapest[component] = link;
        this.activeCandidate = true;
      }
    }
    return false;
  }

  /** 合并阶段：把本轮选中的边逐条接上 */
  private mergeBoruvka(): boolean {
    const link = this.merging[this.mergeIndex++];
    this.activeEdge = link;
    this.checks++;
    // 两个分量可能互相选中同一条边，第二次就会撞上「已经连通」
    this.take(link);

    if (this.mergeIndex >= this.merging.length) {
      this.round++;
      this.cheapest.fill(-1);
      this.scanIndex = 0;
      this.phase = 'scan';
      this.merging = [];
      if (this.dsu.count === 1) return this.finish();
    }
    return false;
  }

  /** 本轮每个分量选中的边，去重后的一批 */
  private collectCheapest(): number[] {
    const picked = new Set<number>();
    for (let node = 0; node < this.count; node++) {
      if (this.dsu.find(node) !== node) continue;
      const link = this.cheapest[node];
      if (link >= 0) picked.add(link);
    }
    return [...picked];
  }

  /** 边的全序：先比权重，并列时比下标。`current` 为 -1 表示还没有 */
  private better(link: number, current: number, weights: Float64Array) {
    if (current < 0) return true;
    const diff = weights[link] - weights[current];
    return diff < 0 || (diff === 0 && link < current);
  }

  // ─── 公共动作 ─────────────────────────────────────────────
  /** 考察一条边：两端不连通就收下并合并，否则丢掉（收了会成环） */
  private take(link: number) {
    const { from, to } = this.scene.graph.edges[link];
    if (!this.dsu.union(from, to)) {
      this.reject(link);
      return;
    }
    this.covered[from] = 1;
    this.covered[to] = 1;
    this.chosen.push(link);
    this.inTree[link] = 1;
    this.weight += this.scene.weights[link];
    this.activeAccepted = true;
  }

  private reject(link: number) {
    this.discarded[link] = 1;
    this.activeRejected = true;
  }

  private finish() {
    this.finished = true;
    return true;
  }
}
