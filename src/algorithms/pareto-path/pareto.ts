import { MinHeap } from '@/lib/min-heap';

import { MAX_LABELS, MAX_SAMPLES } from './constants';
import type { TollNetwork } from './network';
import type { CostPoint, ParetoSolution, ParetoStats } from './types';

/**
 * 多目标标签设定算法（Martins）的可单步内核。
 *
 * Dijkstra 每个节点只留一个数：到这里最便宜多少。这里留不了 ——
 * 「28 分钟 ¥40」和「41 分钟 ¥0」谁更好？没有答案，两个都得留着。
 * 于是节点上的一个数变成了一组**互不支配**的标签，算法从「松弛」
 * 变成了「往这组里塞，塞不进去就丢」。
 *
 * 支配：a 支配 b，当 a 的两个代价都不比 b 差。被支配的标签立刻可以扔掉 ——
 * 沿它走下去的任何结果，沿 a 走都能做得一样好或更好（代价非负）。
 * 算法的全部力气都花在这一句上：没有它，标签数会随路径数指数爆炸。
 *
 * 堆按时间排序，所以标签是按时间递增出堆的；后生成的标签时间只会更大，
 * 因此一个标签一旦出堆，就不可能再被将来的标签支配 —— 这是「出堆即定稿」
 * 在双目标下的对应说法。
 */
export class ParetoRun {
  readonly network: TollNetwork;
  readonly source: number;
  readonly target: number;
  readonly count: number;

  /** 标签的平行数组；下标就是标签 id */
  readonly time: number[] = [];
  readonly toll: number[] = [];
  readonly nodeOf: number[] = [];
  readonly parent: number[] = [];
  readonly alive: boolean[] = [];

  /** 每个节点当前的非支配标签集合 */
  readonly frontiers: number[][];

  /** 终点收到过的所有标签，含后来被淘汰的 —— 散点图的灰点 */
  readonly samples: CostPoint[] = [];

  activeEdge = -1;
  activeAccepted = false;
  /** 正在展开的标签，-1 表示这一步在取下一个标签 */
  cursor = -1;

  private checks = 0;
  private pruned = 0;
  private dropped = 0;
  private expanded = 0;
  private finished = false;
  private overflow = false;
  private edgeCursor = 0;
  private sequence = 0;
  private readonly heap = new MinHeap();

  constructor(network: TollNetwork, source: number, target: number) {
    this.network = network;
    this.source = source;
    this.target = target;
    this.count = network.graph.nodes.length;
    this.frontiers = Array.from({ length: this.count }, () => []);
    this.push(source, 0, 0, -1);
  }

  get done() {
    return this.finished;
  }

  step(): boolean {
    if (this.finished) return true;
    const { graph } = this.network;
    const node = this.cursor >= 0 ? this.nodeOf[this.cursor] : -1;

    // 终点的标签不再往外展开：代价非负，绕出去再回来只会两项都更差
    if (
      this.cursor >= 0 &&
      node !== this.target &&
      this.edgeCursor < graph.outgoing[node].length
    ) {
      const edge = graph.outgoing[node][this.edgeCursor++];
      const to = graph.edges[edge].to;
      const road = this.network.edges[edge];
      this.activeEdge = edge;
      this.checks++;

      const time = this.time[this.cursor] + road.time;
      const toll = this.toll[this.cursor] + road.toll;

      // 先拿终点的前沿剪一刀：已经有一条路两项都不比它差，
      // 那它无论怎么走下去都进不了最终答案
      if (this.dominated(this.target, time, toll)) {
        this.pruned++;
        this.activeAccepted = false;
        return false;
      }
      if (this.dominated(to, time, toll)) {
        this.pruned++;
        this.activeAccepted = false;
        return false;
      }
      this.push(to, time, toll, this.cursor);
      this.activeAccepted = true;
      return false;
    }

    this.activeEdge = -1;
    this.activeAccepted = false;

    let next = -1;
    while (this.heap.size > 0) {
      const label = this.heap.pop();
      // 出堆时才发现已被淘汰 —— 惰性删除，和单目标 Dijkstra 一个套路
      if (!this.alive[label]) continue;
      next = label;
      break;
    }
    if (next < 0) {
      this.cursor = -1;
      this.finished = true;
      return true;
    }
    this.cursor = next;
    this.edgeCursor = 0;
    this.expanded++;
    return false;
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
    const limit = MAX_LABELS * 8 + 1024;
    let guard = 0;
    while (!this.finished && guard++ < limit) this.step();
  }

  /**
   * 帕累托前沿：终点上还活着的那组标签，按时间升序。
   *
   * 互不支配意味着时间递增的同时过路费必然递减 —— 这条「越快越贵」
   * 的曲线就是答案本身。
   */
  solutions(): ParetoSolution[] {
    const list = this.frontiers[this.target]
      .filter(label => this.alive[label])
      .map(label => ({
        path: this.trace(label),
        time: this.time[label],
        toll: this.toll[label],
        supported: false,
      }));
    list.sort((a, b) => a.time - b.time || a.toll - b.toll);
    for (const index of hullCorners(list)) list[index].supported = true;
    return list;
  }

  stats(): ParetoStats {
    const solutions = this.solutions();
    return {
      checks: this.checks,
      created: this.time.length,
      pruned: this.pruned,
      dropped: this.dropped,
      alive: this.alive.reduce((sum, live) => sum + (live ? 1 : 0), 0),
      expanded: this.expanded,
      done: this.finished,
      overflow: this.overflow,
      frontier: solutions.length,
      supported: solutions.filter(item => item.supported).length,
    };
  }

  /** 某个标签走到了哪条路上 */
  trace(label: number): number[] {
    const path: number[] = [];
    for (let at = label; at >= 0; at = this.parent[at]) {
      path.push(this.nodeOf[at]);
      if (path.length > this.time.length) return [];
    }
    return path.reverse();
  }

  /** 节点上此刻留着几个标签 —— 画布上写在圆里的那个数 */
  labelCount(node: number) {
    return this.frontiers[node].length;
  }

  /** 该节点的前沿里有没有谁两项都不比 (time, toll) 差 */
  private dominated(node: number, time: number, toll: number) {
    for (const label of this.frontiers[node]) {
      if (this.time[label] <= time && this.toll[label] <= toll) return true;
    }
    return false;
  }

  private push(node: number, time: number, toll: number, parent: number) {
    if (this.time.length >= MAX_LABELS) {
      this.overflow = true;
      this.finished = true;
      return;
    }

    // 新标签反过来淘汰旧的。相等的情形不会走到这里 ——
    // 那种标签在 dominated() 里就被挡掉了
    const front = this.frontiers[node];
    for (let i = front.length - 1; i >= 0; i--) {
      const label = front[i];
      if (this.time[label] >= time && this.toll[label] >= toll) {
        this.alive[label] = false;
        front.splice(i, 1);
        this.dropped++;
      }
    }

    const id = this.time.length;
    this.time.push(time);
    this.toll.push(toll);
    this.nodeOf.push(node);
    this.parent.push(parent);
    this.alive.push(true);
    front.push(id);
    this.heap.push(time, this.sequence++, id);

    if (node === this.target && this.samples.length < MAX_SAMPLES) {
      this.samples.push({ time, toll });
    }
  }
}

/**
 * 点集下凸包的角点下标。要求输入按 time 升序、且互不支配（toll 严格递减）。
 *
 * 这几个点就是加权和能够选到的全部解：给定 λ，`λ·time + (1-λ)·toll` 的
 * 等值线是一条固定斜率的直线，把它从左下方平推上去，第一个碰到的必然是
 * 凸包的角点。凹处的解永远躲在这条线后面 —— 它确实更优，只是这种问法
 * 问不出来。
 *
 * 共线的点（正好躺在两个角点的连线上）被 `<= 0` 弹了出去：那种解在对应的
 * λ 上和角点并列最优，算法给谁全看 tie-break，不能算「选得到」。
 */
export function hullCorners(points: { time: number; toll: number }[]) {
  const hull: number[] = [];
  for (let i = 0; i < points.length; i++) {
    while (
      hull.length >= 2 &&
      cross(
        points[hull[hull.length - 2]],
        points[hull[hull.length - 1]],
        points[i]
      ) <= 0
    ) {
      hull.pop();
    }
    hull.push(i);
  }
  return hull;
}

function cross(
  o: { time: number; toll: number },
  a: { time: number; toll: number },
  b: { time: number; toll: number }
) {
  return (
    (a.time - o.time) * (b.toll - o.toll) -
    (a.toll - o.toll) * (b.time - o.time)
  );
}

/** 前沿里加权和最小的那个解 —— 偏好 λ 实际会挑中谁 */
export function pickByLambda(solutions: ParetoSolution[], lambda: number) {
  let best = -1;
  let bestCost = Infinity;
  solutions.forEach((solution, index) => {
    const cost = lambda * solution.time + (1 - lambda) * solution.toll;
    if (cost < bestCost - 1e-9) {
      bestCost = cost;
      best = index;
    }
  });
  return best;
}
