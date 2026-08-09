import { MinHeap } from '@/lib/min-heap';

import { dirBetween, openCells, stepTo, turnPenalty } from './grid';
import type { Dir, RouteCost, TurnCosts, TurnGrid, TurnStats } from './types';

const EPS = 1e-9;

/** 一次性算好的两个对照，跟动画进度无关 */
interface Comparison {
  stepsFirst: number[];
  naive: number[];
}

/**
 * 状态空间 Dijkstra：把「格子」换成「格子 + 朝向」。
 *
 * 转弯要钱之后，一条边多贵就不再只取决于这条边 —— 从北边进来再向东走
 * 要转 90°，从西边进来向东走却是直行。同一条边两个价钱，普通的
 * 「dist[格子]」于是装不下需要的信息：你还得知道自己是朝哪儿的。
 *
 * 办法是把朝向塞进状态：节点从 N 个变成 4N 个，状态 id = 格子 × 4 + 朝向。
 * 在这个放大后的图上，边权重新变回「只跟边有关」的常数，
 * Dijkstra 一个字都不用改。代价是搜索空间翻了四倍。
 */
export class TurnRun {
  readonly grid: TurnGrid;
  readonly costs: TurnCosts;
  readonly startDir: Dir;

  /** 每个状态的最小代价，下标 = 格子 × 4 + 朝向 */
  readonly dist: Float64Array;
  /** 前驱状态 */
  readonly parent: Int32Array;
  readonly settled: Uint8Array;
  /** 定稿顺序，画布拿它做波前渐变；-1 表示还没定稿 */
  readonly order: Int32Array;

  /** 正在展开的状态；-1 表示这一步在取下一个状态 */
  cursor = -1;
  /** 正在检查的出边方向 */
  activeDir = -1;
  activeImproved = false;

  private expandedCount = 0;
  private finished = false;
  private reached = false;
  private goalState = -1;
  private dirCursor = 0;
  private sequence = 0;
  private readonly heap = new MinHeap();
  private comparison: Comparison | null = null;

  constructor(grid: TurnGrid, costs: TurnCosts, startDir: Dir) {
    this.grid = grid;
    this.costs = costs;
    this.startDir = startDir;

    const size = grid.cols * grid.rows * 4;
    this.dist = new Float64Array(size).fill(Infinity);
    this.parent = new Int32Array(size).fill(-1);
    this.settled = new Uint8Array(size);
    this.order = new Int32Array(size).fill(-1);

    const first = grid.start * 4 + startDir;
    this.dist[first] = 0;
    this.heap.push(0, this.sequence++, first);
  }

  get done() {
    return this.finished;
  }

  get found() {
    return this.reached;
  }

  /** 已定稿的状态数。画布每帧都要用它做波前渐变，所以不能走 stats() */
  get expanded() {
    return this.expandedCount;
  }

  step(): boolean {
    if (this.finished) return true;

    if (this.cursor >= 0 && this.dirCursor < 4) {
      const dir = this.dirCursor++ as Dir;
      const cell = this.cursor >> 2;
      const facing = (this.cursor & 3) as Dir;
      this.activeDir = dir;
      this.activeImproved = false;

      const next = stepTo(this.grid, cell, dir);
      if (next < 0) return false;

      const state = next * 4 + dir;
      if (this.settled[state]) return false;

      // 先转弯再走一格 —— 边权就是这两项之和
      const candidate =
        this.dist[this.cursor] + turnPenalty(facing, dir, this.costs) + 1;
      if (candidate < this.dist[state] - EPS) {
        this.dist[state] = candidate;
        this.parent[state] = this.cursor;
        this.activeImproved = true;
        this.heap.push(candidate, this.sequence++, state);
      }
      return false;
    }

    this.activeDir = -1;
    this.activeImproved = false;

    let next = -1;
    while (this.heap.size > 0) {
      const state = this.heap.pop();
      if (this.settled[state]) continue;
      next = state;
      break;
    }
    if (next < 0) {
      this.cursor = -1;
      this.finished = true;
      return true;
    }

    this.settled[next] = 1;
    this.order[next] = this.expandedCount++;
    this.cursor = next;
    this.dirCursor = 0;

    // 终点不挑朝向：第一个被定稿的终点状态就是最优
    if (next >> 2 === this.grid.goal) {
      this.goalState = next;
      this.finished = true;
      this.reached = true;
      return true;
    }
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
    const limit = this.dist.length * 8 + 256;
    let guard = 0;
    while (!this.finished && guard++ < limit) this.step();
  }

  /** 最优路线的格子序列 */
  path(): number[] {
    if (!this.reached) return [];
    return traceStates(this.parent, this.goalState);
  }

  /** 先把步数压到最少、再在其中挑转弯最少的那条 */
  stepsFirstPath() {
    return this.compare().stepsFirst;
  }

  /** 在格子层面记转弯账的朴素做法给出的那条 */
  naivePath() {
    return this.compare().naive;
  }

  stats(): TurnStats {
    const comparison = this.compare();
    const bill = (cells: number[]) =>
      cells.length > 1
        ? evaluate(this.grid, cells, this.startDir, this.costs)
        : null;

    return {
      expanded: this.expandedCount,
      total: openCells(this.grid) * 4,
      frontier: this.heap.size,
      done: this.finished,
      found: this.reached,
      best: this.reached ? bill(this.path()) : null,
      stepsFirst: bill(comparison.stepsFirst),
      naive: bill(comparison.naive),
    };
  }

  private compare(): Comparison {
    if (!this.comparison) {
      this.comparison = {
        stepsFirst: stepsFirstPath(this.grid, this.costs, this.startDir),
        naive: naivePath(this.grid, this.costs, this.startDir),
      };
    }
    return this.comparison;
  }
}

/**
 * 「先把路走短，再顺手把弯拉直」：字典序地先最小化步数，再最小化转弯。
 *
 * 它同样在状态空间上搜索，所以转弯数算得一点没错 —— 错的是目标。
 * 步数被当成了硬约束，于是「多绕两步、少转两个弯」这种交易根本不在
 * 考虑范围内，哪怕转弯贵到一次顶三步。
 *
 * 实现上就是把两个目标压成一个字典序的键：`步数 × BIG + 转弯代价`，
 * BIG 取得比任何路线的转弯总代价都大，低位就永远翻不了高位的盘。
 */
export function stepsFirstPath(
  grid: TurnGrid,
  costs: TurnCosts,
  startDir: Dir
): number[] {
  const cells = grid.cols * grid.rows;
  const big = cells * Math.max(costs.turn, costs.uTurn, 1) + 1;
  const size = cells * 4;
  const dist = new Float64Array(size).fill(Infinity);
  const parent = new Int32Array(size).fill(-1);
  const settled = new Uint8Array(size);
  const heap = new MinHeap();
  let sequence = 0;

  const first = grid.start * 4 + startDir;
  dist[first] = 0;
  heap.push(0, sequence++, first);

  while (heap.size > 0) {
    const state = heap.pop();
    if (settled[state]) continue;
    settled[state] = 1;
    const cell = state >> 2;
    if (cell === grid.goal) return traceStates(parent, state);

    const facing = (state & 3) as Dir;
    for (let dir = 0; dir < 4; dir++) {
      const next = stepTo(grid, cell, dir as Dir);
      if (next < 0) continue;
      const target = next * 4 + dir;
      if (settled[target]) continue;
      const candidate =
        dist[state] + big + turnPenalty(facing, dir as Dir, costs);
      if (candidate >= dist[target] - EPS) continue;
      dist[target] = candidate;
      parent[target] = state;
      heap.push(candidate, sequence++, target);
    }
  }
  return [];
}

/**
 * 朴素做法：照样只给每个**格子**记一个距离，转弯代价按「父指针推出来的
 * 进入方向」现算。
 *
 * 看上去很合理，而且它跑得出一条能走的路线 —— 错在别处：Dijkstra
 * 定稿一个格子的时候，顺带把「以什么朝向到达这里」也定死了。可代价更大
 * 但朝向更顺的那条路，后面可能省下更多转弯。格子一旦关闭就再不重开，
 * 那种路线连被考虑的机会都没有。
 *
 * 它给出的答案通常合法、偶尔恰好最优、经常贵一点 —— 最难查的那种错。
 */
export function naivePath(
  grid: TurnGrid,
  costs: TurnCosts,
  startDir: Dir
): number[] {
  const size = grid.cols * grid.rows;
  const dist = new Float64Array(size).fill(Infinity);
  const parent = new Int32Array(size).fill(-1);
  const facing = new Int32Array(size).fill(startDir);
  const settled = new Uint8Array(size);
  const heap = new MinHeap();
  let sequence = 0;

  dist[grid.start] = 0;
  heap.push(0, sequence++, grid.start);

  while (heap.size > 0) {
    const cell = heap.pop();
    if (settled[cell]) continue;
    settled[cell] = 1;
    if (cell === grid.goal) break;

    for (let dir = 0; dir < 4; dir++) {
      const next = stepTo(grid, cell, dir as Dir);
      if (next < 0 || settled[next]) continue;
      const candidate =
        dist[cell] + turnPenalty(facing[cell] as Dir, dir as Dir, costs) + 1;
      if (candidate >= dist[next] - EPS) continue;
      dist[next] = candidate;
      parent[next] = cell;
      facing[next] = dir;
      heap.push(candidate, sequence++, next);
    }
  }

  return tracePath(parent, grid.start, grid.goal);
}

/** 沿一条给定路线开一趟，算出它的账单 */
export function evaluate(
  grid: TurnGrid,
  cells: number[],
  startDir: Dir,
  costs: TurnCosts
): RouteCost {
  let turns = 0;
  let uTurns = 0;
  let cost = 0;
  let facing = startDir;

  for (let i = 1; i < cells.length; i++) {
    const dir = dirBetween(grid, cells[i - 1], cells[i]);
    const penalty = turnPenalty(facing, dir, costs);
    const diff = (dir - facing + 4) % 4;
    if (diff === 2) uTurns++;
    else if (diff !== 0) turns++;
    cost += penalty + 1;
    facing = dir;
  }

  return { steps: cells.length - 1, turns, uTurns, cost };
}

/** 状态链 → 格子序列 */
function traceStates(parent: Int32Array, goalState: number) {
  const cells: number[] = [];
  for (let state = goalState; state >= 0; state = parent[state]) {
    cells.push(state >> 2);
  }
  return cells.reverse();
}

function tracePath(parent: Int32Array, start: number, goal: number) {
  const cells: number[] = [];
  let cell = goal;
  for (let guard = 0; guard <= parent.length; guard++) {
    cells.push(cell);
    if (cell === start) return cells.reverse();
    cell = parent[cell];
    if (cell < 0) return [];
  }
  return [];
}
