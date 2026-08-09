import { SWAMP_COST } from './constants';
import type { GridModel, Heuristic } from './types';

/** 对角移动的距离，等权网格上走对角比走两步直线便宜 */
export const DIAGONAL_COST = Math.SQRT2;

export function createGrid(cols: number, rows: number): GridModel {
  const size = cols * rows;
  const grid: GridModel = {
    cols,
    rows,
    walls: new Uint8Array(size),
    weights: new Float32Array(size).fill(1),
    start: 0,
    goal: 0,
  };
  const { start, goal } = defaultEndpoints(cols, rows);
  grid.start = start;
  grid.goal = goal;
  return grid;
}

/** 起点、终点放在左右两侧的黄金位置，中间留足空间摆障碍 */
export function defaultEndpoints(cols: number, rows: number) {
  const row = Math.floor(rows / 2);
  return {
    start: row * cols + Math.floor(cols * 0.12),
    goal: row * cols + Math.floor(cols * 0.88),
  };
}

export function xOf(grid: GridModel, index: number) {
  return index % grid.cols;
}

export function yOf(grid: GridModel, index: number) {
  return Math.floor(index / grid.cols);
}

export function indexOf(grid: GridModel, x: number, y: number) {
  return y * grid.cols + x;
}

export function inBounds(grid: GridModel, x: number, y: number) {
  return x >= 0 && x < grid.cols && y >= 0 && y < grid.rows;
}

export function isWall(grid: GridModel, index: number) {
  return grid.walls[index] === 1;
}

export function isSwamp(grid: GridModel, index: number) {
  return grid.weights[index] > 1;
}

export function setWall(grid: GridModel, index: number, wall: boolean) {
  // 起点和终点不允许被墙覆盖，否则一开局就无解
  if (index === grid.start || index === grid.goal) return;
  grid.walls[index] = wall ? 1 : 0;
  if (wall) grid.weights[index] = 1;
}

export function setSwamp(grid: GridModel, index: number, swamp: boolean) {
  if (index === grid.start || index === grid.goal) return;
  grid.walls[index] = 0;
  grid.weights[index] = swamp ? SWAMP_COST : 1;
}

export function clearTerrain(grid: GridModel) {
  grid.walls.fill(0);
  grid.weights.fill(1);
}

/**
 * 取邻居，写进 out 并返回数量（避免每次分配数组）。
 *
 * 对角移动禁止"切角"：只有当两侧的直角邻居都不是墙时才允许斜穿，
 * 否则路径会从两堵墙的缝里穿过去，看起来像穿模。
 */
export function neighbors(
  grid: GridModel,
  index: number,
  allowDiagonal: boolean,
  out: Int32Array
): number {
  const x = xOf(grid, index);
  const y = yOf(grid, index);
  let count = 0;

  const up = inBounds(grid, x, y - 1) && !isWall(grid, indexOf(grid, x, y - 1));
  const down =
    inBounds(grid, x, y + 1) && !isWall(grid, indexOf(grid, x, y + 1));
  const left =
    inBounds(grid, x - 1, y) && !isWall(grid, indexOf(grid, x - 1, y));
  const right =
    inBounds(grid, x + 1, y) && !isWall(grid, indexOf(grid, x + 1, y));

  if (up) out[count++] = indexOf(grid, x, y - 1);
  if (down) out[count++] = indexOf(grid, x, y + 1);
  if (left) out[count++] = indexOf(grid, x - 1, y);
  if (right) out[count++] = indexOf(grid, x + 1, y);

  if (!allowDiagonal) return count;

  const diagonals: [boolean, number, number][] = [
    [up && left, x - 1, y - 1],
    [up && right, x + 1, y - 1],
    [down && left, x - 1, y + 1],
    [down && right, x + 1, y + 1],
  ];
  for (const [allowed, nx, ny] of diagonals) {
    if (!allowed || !inBounds(grid, nx, ny)) continue;
    const next = indexOf(grid, nx, ny);
    if (!isWall(grid, next)) out[count++] = next;
  }
  return count;
}

/** 从 from 走到 to 的代价：地形权重 × 距离 */
export function stepCost(grid: GridModel, from: number, to: number) {
  const diagonal =
    xOf(grid, from) !== xOf(grid, to) && yOf(grid, from) !== yOf(grid, to);
  return grid.weights[to] * (diagonal ? DIAGONAL_COST : 1);
}

/**
 * 启发式必须与移动方式匹配才可采纳（admissible）：
 * 四向移动配曼哈顿，八向移动配八方距离。八向移动下用曼哈顿会高估，
 * A* 就不再保证最短路 —— 这一点在页面上可以直接调出来看。
 */
export function heuristic(
  grid: GridModel,
  from: number,
  to: number,
  kind: Heuristic
) {
  const dx = Math.abs(xOf(grid, from) - xOf(grid, to));
  const dy = Math.abs(yOf(grid, from) - yOf(grid, to));
  switch (kind) {
    case 'manhattan':
      return dx + dy;
    case 'euclidean':
      return Math.hypot(dx, dy);
    case 'octile':
      return dx + dy + (DIAGONAL_COST - 2) * Math.min(dx, dy);
    case 'none':
      return 0;
  }
}
