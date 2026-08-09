import { tracePath } from '@/lib/graph/model';
import { MinHeap } from '@/lib/min-heap';

import {
  arriveVia,
  bestArrival,
  dijkstraFixed,
  type RoadNetwork,
  simulate,
} from './network';
import type { FastestStats } from './types';

const EPS = 1e-9;

/** 一次性算好的两个对照，跟动画无关，用到时才算 */
interface Comparison {
  /** 只按自由流时间选的路线 —— 没有实时路况的导航会给的答案 */
  staticPath: number[];
  /** 这条路线在真实路况里跑，每个节点几点到 */
  staticTimes: number[];
  staticArrival: number;
  /** 多标签搜索找到的更早到达 */
  bestPath: number[];
  bestArrival: number;
}

/**
 * 时间依赖 Dijkstra 的可单步内核。
 *
 * 和普通 Dijkstra 只差一个字：标签不是「距离」而是「最早到达时刻」，
 * 松弛时用的边权要现算 ——
 *
 *   arrival[v] = min(arrival[v], t + τ(e, t))，其中 t = arrival[u]
 *
 * 同一条边在 7:00 和 8:30 出发是两个价钱，所以必须先知道几点到 u，
 * 才知道这条边多长。这也正是它仍然能用 Dijkstra 那套「挑最小、定稿」的
 * 前提：只有当「早出发绝不会晚到」（FIFO / 非超车）成立时，
 * 最早到达的那个节点才真的可以定稿。
 */
export class FastestPathRun {
  readonly network: RoadNetwork;
  readonly source: number;
  readonly target: number;
  readonly departure: number;
  readonly count: number;

  /** 各节点的最早到达时刻 */
  readonly arrival: Float64Array;
  readonly parent: Int32Array;
  readonly settled: Uint8Array;

  activeEdge = -1;
  activeImproved = false;
  cursor = -1;

  private checks = 0;
  private improvements = 0;
  private settledCount = 0;
  private finished = false;
  private edgeCursor = 0;
  private sequence = 0;
  private readonly heap = new MinHeap();
  private comparison: Comparison | null = null;

  constructor(
    network: RoadNetwork,
    source: number,
    target: number,
    departure: number
  ) {
    this.network = network;
    this.source = source;
    this.target = target;
    this.departure = departure;
    this.count = network.graph.nodes.length;

    this.arrival = new Float64Array(this.count).fill(Infinity);
    this.parent = new Int32Array(this.count).fill(-1);
    this.settled = new Uint8Array(this.count);
    this.arrival[source] = departure;
    this.heap.push(departure, this.sequence++, source);
  }

  get done() {
    return this.finished;
  }

  step(): boolean {
    if (this.finished) return true;
    const { graph } = this.network;

    if (
      this.cursor >= 0 &&
      this.edgeCursor < graph.outgoing[this.cursor].length
    ) {
      const edge = graph.outgoing[this.cursor][this.edgeCursor++];
      const to = graph.edges[edge].to;
      this.activeEdge = edge;
      this.checks++;

      if (this.settled[to]) {
        this.activeImproved = false;
        return false;
      }
      const reach = arriveVia(this.network, edge, this.arrival[this.cursor]);
      if (reach < this.arrival[to] - EPS) {
        this.arrival[to] = reach;
        this.parent[to] = this.cursor;
        this.improvements++;
        this.activeImproved = true;
        this.heap.push(reach, this.sequence++, to);
      } else {
        this.activeImproved = false;
      }
      return false;
    }

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

  advance(steps: number) {
    let taken = 0;
    while (taken < steps && !this.finished) {
      this.step();
      taken++;
    }
    return taken;
  }

  runToEnd() {
    const limit = this.count * this.network.graph.edges.length * 2 + 64;
    let guard = 0;
    while (!this.finished && guard++ < limit) this.step();
  }

  /** Dijkstra 选出来的路线 */
  path(): number[] {
    if (!Number.isFinite(this.arrival[this.target])) return [];
    return tracePath(this.parent, this.source, this.target);
  }

  /** 这条路线上每个节点的到达时刻，发车动画照着它走 */
  times(): number[] {
    return simulate(this.network, this.path(), this.departure);
  }

  staticPath() {
    return this.compare().staticPath;
  }

  staticTimes() {
    return this.compare().staticTimes;
  }

  /** 多标签搜索找到的更优路线；和 Dijkstra 一样时返回空 */
  betterPath() {
    const comparison = this.compare();
    if (comparison.bestArrival >= this.arrival[this.target] - EPS) return [];
    return comparison.bestPath;
  }

  stats(): FastestStats {
    const comparison = this.compare();
    const arrival = this.arrival[this.target];
    const reached = Number.isFinite(arrival);
    const path = this.path();
    return {
      checks: this.checks,
      improvements: this.improvements,
      settled: this.settledCount,
      total: this.count,
      done: this.finished,
      reached,
      arrival,
      duration: reached ? arrival - this.departure : Infinity,
      staticArrival: comparison.staticArrival,
      sameRoute: samePath(path, comparison.staticPath),
      bestArrival: comparison.bestArrival,
      lateBy:
        this.finished && reached
          ? Math.max(0, arrival - comparison.bestArrival)
          : 0,
    };
  }

  /**
   * 两个对照都只跟「路网 + 端点 + 出发时刻」有关，跟动画进度无关，
   * 所以整局只算一次。
   */
  private compare(): Comparison {
    if (this.comparison) return this.comparison;

    const free = Float64Array.from(this.network.edges, edge => edge.free);
    const { parent } = dijkstraFixed(this.network.graph, free, this.source);
    const staticPath = tracePath(parent, this.source, this.target);
    const staticTimes = simulate(this.network, staticPath, this.departure);
    const best = bestArrival(
      this.network,
      this.source,
      this.target,
      this.departure
    );

    this.comparison = {
      staticPath,
      staticTimes,
      staticArrival:
        staticTimes.length === staticPath.length && staticPath.length > 0
          ? staticTimes[staticTimes.length - 1]
          : Infinity,
      bestPath: best.path,
      bestArrival: best.arrival,
    };
    return this.comparison;
  }
}

function samePath(a: number[], b: number[]) {
  return a.length === b.length && a.every((node, index) => node === b[index]);
}
