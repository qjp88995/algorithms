import type { FlowScene } from './network';
import {
  cutCapacity,
  cutEdges,
  FLOW_EPS,
  residual,
  sourceSide,
} from './reference';
import type { FlowAlgorithm, FlowStats } from './types';

/**
 * 最大流的可单步内核。
 *
 * 三个算法是同一个框架 —— **找一条还能推流的路，推满它，重复** ——
 * 区别只在「下一条路怎么找」：
 *
 *   Ford-Fulkerson  深度优先，撞见哪条算哪条。整数容量下一定会停，
 *                   但次数可能跟流量本身一样多，而不是跟图的大小有关。
 *   Edmonds-Karp    改成广度优先，每次都取边数最少的那条增广路。
 *                   就这一个改动，上界变成 O(V·E²) —— 和流量无关了。
 *   Dinic           先 BFS 把点分层，再在层次图里一口气榨干所有当前
 *                   最短的增广路（阻塞流）。每个相位过后最短增广路
 *                   至少长一条边，所以最多 V 个相位。
 *
 * 全程只有一个数据结构：**残量网络**。`lib/graph/` 把每条连线拆成方向
 * 相反的两条边，正向挂容量、反向容量为 0；推流时正向加、反向减，于是
 * 反向边的残量恰好等于"已经推过多少"。沿反向边走一步，就是把之前的
 * 决定退回去一部分 —— 贪心之所以能得到最优解，全靠这个后悔的余地。
 *
 * 内核不碰 canvas、不碰 React。`activeEdge` / `pathEdges` 这些不是算法
 * 必需的状态，而是"这一拍在看哪里"，画布靠它们把循环变量画成高亮。
 */
export class MaxFlowRun {
  readonly scene: FlowScene;
  readonly algorithm: FlowAlgorithm;
  readonly count: number;

  /** 每条有向边上的流；一条推多少，它的反向边就是负多少 */
  readonly flow: Float64Array;
  /** Dinic 的层次；不在层次图里的点是 -1。其余算法全程 -1 */
  readonly level: Int32Array;

  /** 这一拍正在考察的边；-1 表示没有 */
  activeEdge = -1;
  /** 当前正在往下探的那条路（边序列，从源点起） */
  pathEdges: number[] = [];
  /** 刚推完的那条增广路，画布拿它做余晖 */
  lastPath: number[] = [];
  lastAmount = 0;
  /** 刚那条路里有没有用到反向边 —— 也就是这一步在退货 */
  lastUsedReverse = false;

  private value = 0;
  private augmentations = 0;
  private checks = 0;
  private phaseCount = 0;
  private finished = false;

  /** 搜索栈：stack[i] 是路径上第 i 个点，pathEdges[i] 是它到下一个点的边 */
  private stack: number[] = [];
  /** 每个点的当前弧 —— Dinic 靠它不重复试同一条边 */
  private readonly iter: Int32Array;
  private readonly visited: Uint8Array;

  // ─── 广度优先（Edmonds-Karp / Dinic 的分层） ───
  private queue: number[] = [];
  private head = 0;
  private readonly parentEdge: Int32Array;
  /** Dinic 当前处在哪个阶段 */
  private dinicStage: 'level' | 'flow' = 'level';

  /** 跑完之后才算的最小割，算一次就存下来 */
  private cut: { edges: number[]; capacity: number } | null = null;

  constructor(scene: FlowScene, algorithm: FlowAlgorithm) {
    this.scene = scene;
    this.algorithm = algorithm;
    this.count = scene.graph.nodes.length;

    this.flow = new Float64Array(scene.graph.edges.length);
    this.level = new Int32Array(this.count).fill(-1);
    this.iter = new Int32Array(this.count);
    this.visited = new Uint8Array(this.count);
    this.parentEdge = new Int32Array(this.count).fill(-1);

    if (algorithm === 'dinic') this.beginLevels();
    else if (algorithm === 'edmonds-karp') this.beginBreadthSearch();
    else this.beginDepthSearch();
  }

  get done() {
    return this.finished;
  }

  /** 这条边还能再推多少 */
  residualOf(edge: number) {
    return residual(this.scene.capacity, this.flow, edge);
  }

  /** 这条有向边在原图里不存在 —— 它只是残量网络里的退货通道 */
  isReverse(edge: number) {
    return this.scene.capacity[edge] === 0;
  }

  /** 展开一次「考察一条边」，返回是否已经结束 */
  step(): boolean {
    if (this.finished) return true;
    switch (this.algorithm) {
      case 'ford-fulkerson':
        return this.stepDepth();
      case 'edmonds-karp':
        return this.stepBreadth();
      case 'dinic':
        return this.dinicStage === 'level'
          ? this.stepLevels()
          : this.stepBlocking();
    }
  }

  runToEnd() {
    const edges = this.scene.graph.edges.length;
    // 整数容量下增广次数不会超过最大流本身，每次搜索最多把边走一遍再退回来
    const limit =
      (this.scene.maxFlow + 1) * (edges + this.count * 2) + edges * 4 + 512;
    let guard = 0;
    while (!this.finished && guard++ < limit) this.step();
  }

  /** 残量网络里从源点还够得着的点 —— 跑完之后这就是最小割的一侧 */
  side() {
    return sourceSide(
      this.scene.graph,
      this.scene.capacity,
      this.flow,
      this.scene.source
    );
  }

  stats(): FlowStats {
    const cut = this.finished ? this.minCut() : null;
    return {
      checks: this.checks,
      value: this.value,
      augmentations: this.augmentations,
      phase: this.algorithm === 'dinic' ? this.phaseCount : 0,
      done: this.finished,
      optimal:
        this.finished && Math.abs(this.value - this.scene.maxFlow) < 1e-9,
      cutCapacity: cut?.capacity ?? 0,
      cutEdges: cut?.edges.length ?? 0,
      usedReverse: this.lastUsedReverse,
    };
  }

  /** 最小割的那组边；只在跑完之后有意义 */
  minCut() {
    if (!this.finished) return null;
    if (!this.cut) {
      const edges = cutEdges(
        this.scene.graph,
        this.scene.capacity,
        this.side()
      );
      this.cut = { edges, capacity: cutCapacity(this.scene.capacity, edges) };
    }
    return this.cut;
  }

  // ─── Ford-Fulkerson：深度优先 ─────────────────────────────
  private beginDepthSearch() {
    this.stack = [this.scene.source];
    this.pathEdges = [];
    this.iter.fill(0);
    this.visited.fill(0);
    this.visited[this.scene.source] = 1;
  }

  private stepDepth(): boolean {
    const { graph, sink } = this.scene;
    const node = this.stack[this.stack.length - 1];

    if (node === sink) {
      this.augment();
      this.beginDepthSearch();
      return false;
    }

    const out = graph.outgoing[node];
    if (this.iter[node] < out.length) {
      const edge = out[this.iter[node]++];
      this.activeEdge = edge;
      this.checks++;
      const { to } = graph.edges[edge];
      // 走得通就走 —— 不比较、不挑选，这就是它和另外两个的全部差别
      if (this.residualOf(edge) > FLOW_EPS && !this.visited[to]) {
        this.visited[to] = 1;
        this.stack.push(to);
        this.pathEdges.push(edge);
      }
      return false;
    }

    // 这个点的边全试过了，退回上一步
    this.stack.pop();
    this.activeEdge = this.pathEdges.pop() ?? -1;
    if (this.stack.length === 0) return this.finish();
    return false;
  }

  // ─── Edmonds-Karp：广度优先 ───────────────────────────────
  private beginBreadthSearch() {
    this.queue = [this.scene.source];
    this.head = 0;
    this.pathEdges = [];
    this.iter.fill(0);
    this.visited.fill(0);
    this.visited[this.scene.source] = 1;
    this.parentEdge.fill(-1);
  }

  private stepBreadth(): boolean {
    const { graph, sink } = this.scene;

    // 跳过已经展开完的点，让每一步都真的考察一条边
    while (
      this.head < this.queue.length &&
      this.iter[this.queue[this.head]] >=
        graph.outgoing[this.queue[this.head]].length
    ) {
      this.head++;
    }
    // 队列见底还没碰到汇点：残量网络里已经没有增广路了
    if (this.head >= this.queue.length) return this.finish();

    const node = this.queue[this.head];
    const edge = graph.outgoing[node][this.iter[node]++];
    this.activeEdge = edge;
    this.checks++;

    const { to } = graph.edges[edge];
    if (this.residualOf(edge) <= FLOW_EPS || this.visited[to]) return false;

    this.visited[to] = 1;
    this.parentEdge[to] = edge;
    this.queue.push(to);

    // 一碰到汇点就收工 —— BFS 先到达的必然是边数最少的那条路
    if (to === sink) {
      this.pathEdges = this.tracePath();
      this.augment();
      this.beginBreadthSearch();
    }
    return false;
  }

  /** 从汇点沿父边回溯出整条增广路 */
  private tracePath(): number[] {
    const { graph, source, sink } = this.scene;
    const path: number[] = [];
    for (let node = sink; node !== source;) {
      const edge = this.parentEdge[node];
      if (edge < 0) return [];
      path.push(edge);
      node = graph.edges[edge].from;
    }
    return path.reverse();
  }

  // ─── Dinic ────────────────────────────────────────────────
  private beginLevels() {
    this.dinicStage = 'level';
    this.level.fill(-1);
    this.level[this.scene.source] = 0;
    this.queue = [this.scene.source];
    this.head = 0;
    this.pathEdges = [];
    this.iter.fill(0);
  }

  /** 分层阶段：BFS 给每个点标上「离源点几条边」 */
  private stepLevels(): boolean {
    const { graph, sink } = this.scene;

    while (
      this.head < this.queue.length &&
      this.iter[this.queue[this.head]] >=
        graph.outgoing[this.queue[this.head]].length
    ) {
      this.head++;
    }

    if (this.head >= this.queue.length) {
      // 汇点已经不在层次图里 —— 没有增广路了，最大流到手
      if (this.level[sink] < 0) return this.finish();
      this.phaseCount++;
      this.beginBlocking();
      return false;
    }

    const node = this.queue[this.head];
    const edge = graph.outgoing[node][this.iter[node]++];
    this.activeEdge = edge;
    this.checks++;

    const { to } = graph.edges[edge];
    if (this.residualOf(edge) > FLOW_EPS && this.level[to] < 0) {
      this.level[to] = this.level[node] + 1;
      this.queue.push(to);
    }
    return false;
  }

  private beginBlocking() {
    this.dinicStage = 'flow';
    this.stack = [this.scene.source];
    this.pathEdges = [];
    this.iter.fill(0);
  }

  /**
   * 阻塞流阶段：在层次图里反复找路，直到一条都找不出来。
   *
   * 只走「层次正好加一」的边，所以找到的每条路都是当前最短的。
   * `iter` 全程不重置，这就是当前弧优化：一条边要么被推满、要么被
   * 判定为死路，两种情况都不必再看第二眼。
   */
  private stepBlocking(): boolean {
    const { graph, sink } = this.scene;
    const node = this.stack[this.stack.length - 1];

    if (node === sink) {
      this.augment();
      this.rewindToSaturated();
      return false;
    }

    const out = graph.outgoing[node];
    if (this.iter[node] < out.length) {
      const edge = out[this.iter[node]];
      this.activeEdge = edge;
      this.checks++;
      const { to } = graph.edges[edge];
      if (
        this.residualOf(edge) > FLOW_EPS &&
        this.level[to] === this.level[node] + 1
      ) {
        this.stack.push(to);
        this.pathEdges.push(edge);
      } else {
        this.iter[node]++;
      }
      return false;
    }

    // 从这个点在层次图里走不到汇点，直接从层次图里剪掉
    this.level[node] = -1;
    this.stack.pop();
    if (this.pathEdges.length > 0) {
      this.activeEdge = this.pathEdges.pop()!;
      this.iter[this.stack[this.stack.length - 1]]++;
    }
    // 连源点都退完了，说明这一相位的阻塞流已经饱和，回去重新分层
    if (this.stack.length === 0) this.beginLevels();
    return false;
  }

  /**
   * 推完流之后退回到第一条被推满的边。
   *
   * 不必从源点重来 —— 那条饱和边之前的部分都还有余量，下一条路照样
   * 要经过它们。这也是当前弧优化能成立的地方：饱和的那条边就此翻篇。
   */
  private rewindToSaturated() {
    let index = 0;
    while (
      index < this.pathEdges.length &&
      this.residualOf(this.pathEdges[index]) > FLOW_EPS
    ) {
      index++;
    }
    if (index >= this.pathEdges.length) {
      this.stack.length = 1;
      this.pathEdges.length = 0;
      return;
    }
    this.iter[this.stack[index]]++;
    this.stack.length = index + 1;
    this.pathEdges.length = index;
  }

  // ─── 公共动作 ─────────────────────────────────────────────
  /** 沿当前这条路推流：能推多少由路上最窄的一段说了算 */
  private augment() {
    const { graph } = this.scene;
    let bottleneck = Infinity;
    for (const edge of this.pathEdges) {
      bottleneck = Math.min(bottleneck, this.residualOf(edge));
    }
    if (!Number.isFinite(bottleneck) || bottleneck <= FLOW_EPS) return;

    let usedReverse = false;
    for (const edge of this.pathEdges) {
      this.flow[edge] += bottleneck;
      this.flow[graph.edges[edge].reverse] -= bottleneck;
      if (this.isReverse(edge)) usedReverse = true;
    }

    this.value += bottleneck;
    this.augmentations++;
    this.lastPath = [...this.pathEdges];
    this.lastAmount = bottleneck;
    this.lastUsedReverse = usedReverse;
  }

  private finish() {
    this.finished = true;
    this.activeEdge = -1;
    this.pathEdges = [];
    return true;
  }
}
