import { heuristic, neighbors, stepCost } from './grid';
import {
  type GridModel,
  NODE_CLOSED,
  NODE_OPEN,
  type SearchConfig,
  type SearchStats,
} from './types';

/**
 * 网格寻路的统一内核。
 *
 * A*、Dijkstra、BFS、贪心最佳优先并不是四个算法，而是同一个
 * 最佳优先搜索配四种优先队列排序键：
 *
 *   bfs      key = 入队序号   → 堆退化成 FIFO 队列，按层扩展
 *   dijkstra key = g          → 只看已走代价
 *   greedy   key = h          → 只看终点估计
 *   astar    key = g + w·h    → 两者相加
 *
 * 把它们写成一份代码，正是这个演示想说明的事：改一行排序键，
 * 扩张形状和最优性保证就完全不同。
 *
 * 内核不碰 canvas、不碰 React，可以单步执行，方便做动画和测试。
 */
export class PathSearch {
  readonly grid: GridModel;
  readonly config: SearchConfig;

  /** 每个节点的状态：未访问 / 边界 / 已展开 */
  readonly state: Uint8Array;
  /** 展开顺序，用于把搜索波前画成渐变色；-1 表示尚未展开 */
  readonly order: Int32Array;
  readonly gScore: Float32Array;
  readonly cameFrom: Int32Array;

  private readonly open = new MinHeap();
  private readonly neighborBuffer = new Int32Array(8);
  private sequence = 0;
  private expanded = 0;
  private finished = false;
  private reached = false;

  constructor(grid: GridModel, config: SearchConfig) {
    this.grid = grid;
    this.config = config;

    const size = grid.cols * grid.rows;
    this.state = new Uint8Array(size);
    this.order = new Int32Array(size).fill(-1);
    this.gScore = new Float32Array(size).fill(Infinity);
    this.cameFrom = new Int32Array(size).fill(-1);

    this.gScore[grid.start] = 0;
    this.state[grid.start] = NODE_OPEN;
    this.open.push(this.priority(grid.start, 0), this.sequence++, grid.start);
  }

  get done() {
    return this.finished;
  }

  get found() {
    return this.reached;
  }

  /** 展开一个节点，返回搜索是否已经结束 */
  step(): boolean {
    if (this.finished) return true;

    const current = this.popNext();
    if (current < 0) {
      // open 空了还没到终点：起点和终点之间被墙完全隔断
      this.finished = true;
      return true;
    }

    if (current === this.grid.goal) {
      this.state[current] = NODE_CLOSED;
      this.order[current] = this.expanded++;
      this.finished = true;
      this.reached = true;
      return true;
    }

    this.state[current] = NODE_CLOSED;
    this.order[current] = this.expanded++;

    const count = neighbors(
      this.grid,
      current,
      this.config.allowDiagonal,
      this.neighborBuffer
    );

    for (let i = 0; i < count; i++) {
      const next = this.neighborBuffer[i];
      if (this.state[next] === NODE_CLOSED) continue;

      // BFS 按格数扩展，无视地形权重 —— 所以它只在等权图上等于最短路
      const cost =
        this.config.algorithm === 'bfs'
          ? 1
          : stepCost(this.grid, current, next);
      const tentative = this.gScore[current] + cost;

      if (this.config.algorithm === 'greedy') {
        // 贪心最佳优先不做代价松弛：谁先发现就认谁当父节点，之后不再改。
        // 这正是它不保证最短路的原因 —— 一旦先扎进死胡同，
        // 回溯出来的路径就带着那段冤枉路。
        if (this.state[next] === NODE_OPEN) continue;
        this.gScore[next] = tentative;
        this.cameFrom[next] = current;
        this.state[next] = NODE_OPEN;
        this.open.push(this.priority(next, tentative), this.sequence++, next);
        continue;
      }

      if (tentative >= this.gScore[next]) continue;

      this.gScore[next] = tentative;
      this.cameFrom[next] = current;
      this.state[next] = NODE_OPEN;
      // 惰性删除：不做 decrease-key，直接重复入堆，
      // 弹出时用 gScore 校验是否为过期条目
      this.open.push(this.priority(next, tentative), this.sequence++, next);
    }

    return false;
  }

  /** 连续展开若干步，返回本次实际展开的节点数 */
  advance(steps: number): number {
    let taken = 0;
    while (taken < steps && !this.finished) {
      this.step();
      taken++;
    }
    return taken;
  }

  runToEnd(limit = this.state.length * 4) {
    let guard = 0;
    while (!this.finished && guard++ < limit) this.step();
  }

  /** 回溯 cameFrom 得到路径（从起点到终点）；没找到时返回空数组 */
  path(): number[] {
    if (!this.reached) return [];
    const result: number[] = [];
    let node = this.grid.goal;
    while (node !== -1) {
      result.push(node);
      if (node === this.grid.start) break;
      node = this.cameFrom[node];
    }
    return result.reverse();
  }

  stats(): SearchStats {
    const path = this.path();
    let cost = 0;
    for (let i = 1; i < path.length; i++) {
      cost += stepCost(this.grid, path[i - 1], path[i]);
    }
    return {
      expanded: this.expanded,
      frontier: this.open.size,
      pathLength: path.length,
      pathCost: cost,
      done: this.finished,
      found: this.reached,
    };
  }

  /** 弹出下一个待展开节点，跳过惰性删除留下的过期条目 */
  private popNext(): number {
    while (this.open.size > 0) {
      const node = this.open.pop();
      if (this.state[node] === NODE_CLOSED) continue;
      return node;
    }
    return -1;
  }

  private priority(node: number, g: number): number {
    const { algorithm, heuristic: kind, heuristicWeight } = this.config;
    if (algorithm === 'bfs') return this.sequence;
    if (algorithm === 'dijkstra') return g;

    const h = heuristic(this.grid, node, this.grid.goal, kind);
    if (algorithm === 'greedy') return h;
    return g + heuristicWeight * h;
  }
}

/**
 * 二叉最小堆。key 相同时按入堆序号先进先出 —— 这个 tie-break 让
 * BFS 能直接复用堆（key 恒等于序号时堆就是一个 FIFO 队列）。
 */
class MinHeap {
  private keys: number[] = [];
  private seqs: number[] = [];
  private items: number[] = [];

  get size() {
    return this.items.length;
  }

  push(key: number, seq: number, item: number) {
    this.keys.push(key);
    this.seqs.push(seq);
    this.items.push(item);
    this.bubbleUp(this.items.length - 1);
  }

  pop(): number {
    const item = this.items[0];
    const last = this.items.length - 1;
    if (last > 0) {
      this.swap(0, last);
    }
    this.keys.pop();
    this.seqs.pop();
    this.items.pop();
    if (this.items.length > 0) this.sinkDown(0);
    return item;
  }

  private less(a: number, b: number) {
    if (this.keys[a] !== this.keys[b]) return this.keys[a] < this.keys[b];
    return this.seqs[a] < this.seqs[b];
  }

  private swap(a: number, b: number) {
    [this.keys[a], this.keys[b]] = [this.keys[b], this.keys[a]];
    [this.seqs[a], this.seqs[b]] = [this.seqs[b], this.seqs[a]];
    [this.items[a], this.items[b]] = [this.items[b], this.items[a]];
  }

  private bubbleUp(index: number) {
    while (index > 0) {
      const parent = (index - 1) >> 1;
      if (!this.less(index, parent)) break;
      this.swap(index, parent);
      index = parent;
    }
  }

  private sinkDown(index: number) {
    const length = this.items.length;
    for (;;) {
      const left = index * 2 + 1;
      const right = left + 1;
      let smallest = index;
      if (left < length && this.less(left, smallest)) smallest = left;
      if (right < length && this.less(right, smallest)) smallest = right;
      if (smallest === index) break;
      this.swap(index, smallest);
      index = smallest;
    }
  }
}
