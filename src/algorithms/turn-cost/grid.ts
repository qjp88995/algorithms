import { seededRandom } from '@/lib/random';

import type { Dir, TurnConfig, TurnCosts, TurnGrid } from './types';

/** 朝向对应的位移，下标就是 Dir */
export const DX = [1, 0, -1, 0];
export const DY = [0, 1, 0, -1];
export const DIR_ARROWS = ['→', '↓', '←', '↑'];
export const DIR_NAMES = ['向右', '向下', '向左', '向上'];

export function xOf(grid: TurnGrid, index: number) {
  return index % grid.cols;
}

export function yOf(grid: TurnGrid, index: number) {
  return Math.floor(index / grid.cols);
}

export function indexOf(grid: TurnGrid, x: number, y: number) {
  return y * grid.cols + x;
}

export function isWall(grid: TurnGrid, index: number) {
  return grid.walls[index] === 1;
}

/** 从 index 朝 dir 走一格是谁；出界或撞墙返回 -1 */
export function stepTo(grid: TurnGrid, index: number, dir: Dir) {
  const x = xOf(grid, index) + DX[dir];
  const y = yOf(grid, index) + DY[dir];
  if (x < 0 || y < 0 || x >= grid.cols || y >= grid.rows) return -1;
  const next = indexOf(grid, x, y);
  return isWall(grid, next) ? -1 : next;
}

/** 相邻两格之间的行进方向 */
export function dirBetween(grid: TurnGrid, from: number, to: number): Dir {
  const dx = xOf(grid, to) - xOf(grid, from);
  return (
    dx > 0 ? 0 : dx < 0 ? 2 : yOf(grid, to) > yOf(grid, from) ? 1 : 3
  ) as Dir;
}

/**
 * 从 `from` 朝向转到 `to` 朝向要付多少代价。
 *
 * 直行免费、转弯要钱 —— 就是这一条规则，把「代价只跟边有关」这个
 * 前提打破了：同一条边多贵，取决于你是从哪个方向进来的。
 */
export function turnPenalty(from: Dir, to: Dir, costs: TurnCosts) {
  const diff = (to - from + 4) % 4;
  if (diff === 0) return 0;
  if (diff === 2) return costs.uTurn;
  return costs.turn;
}

/**
 * 铺一张「开阔场地 + 柱子」的地图。
 *
 * 刻意不用迷宫：完美迷宫里两点之间只有一条路，转弯再贵也没得选，
 * 这一页就没东西可看了。开阔场地正相反 —— 起点到终点的最短步数路线有
 * 无数条，它们步数完全一样，转弯次数却从 1 次到十几次不等。
 * 转弯一旦计价，这些「一样短」的路线立刻分出高下。
 */
export function buildGrid(config: TurnConfig): TurnGrid {
  const { cols, rows } = config;
  // 对角布置：起点左上、终点右下。这样最短路既要向右也要向下，
  // 「怎么分配这些转弯」才成为一个真问题
  const start = cols + 1;
  const goal = (rows - 2) * cols + (cols - 2);

  // 撒出来的障碍可能把终点封死，换一串随机数重来；
  // 试到底还不通就交给调用方 —— 统计栏会显示「不可达」
  for (let attempt = 0; attempt < 24; attempt++) {
    const grid: TurnGrid = {
      cols,
      rows,
      walls: new Uint8Array(cols * rows),
      start,
      goal,
    };
    scatterBlocks(
      grid,
      config.density,
      seededRandom(config.seed + attempt * 7919)
    );
    if (connected(grid)) return grid;
  }

  return {
    cols,
    rows,
    walls: new Uint8Array(cols * rows),
    start,
    goal,
  };
}

/** 撒块状障碍。单格的障碍看着像噪点，成块的才像建筑 */
function scatterBlocks(grid: TurnGrid, density: number, random: () => number) {
  const target = grid.cols * grid.rows * density;
  let placed = 0;
  let guard = 0;

  while (placed < target && guard++ < 400) {
    const w = 1 + Math.floor(random() * 3);
    const h = 1 + Math.floor(random() * 3);
    const x = Math.floor(random() * (grid.cols - w));
    const y = Math.floor(random() * (grid.rows - h));

    for (let dy = 0; dy < h; dy++) {
      for (let dx = 0; dx < w; dx++) {
        const index = indexOf(grid, x + dx, y + dy);
        if (grid.walls[index] === 1) continue;
        grid.walls[index] = 1;
        placed++;
      }
    }
  }

  clearAround(grid, grid.start);
  clearAround(grid, grid.goal);
}

/** 起终点及其四邻必须是空地，否则一开局就被封死 */
function clearAround(grid: TurnGrid, index: number) {
  const x = xOf(grid, index);
  const y = yOf(grid, index);
  for (const [dx, dy] of [
    [0, 0],
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1],
  ]) {
    const nx = x + dx;
    const ny = y + dy;
    if (nx < 0 || ny < 0 || nx >= grid.cols || ny >= grid.rows) continue;
    grid.walls[indexOf(grid, nx, ny)] = 0;
  }
}

/** 起点能不能走到终点 —— 泛洪一次就知道 */
function connected(grid: TurnGrid) {
  const seen = new Uint8Array(grid.walls.length);
  const queue = [grid.start];
  seen[grid.start] = 1;

  for (let head = 0; head < queue.length; head++) {
    const index = queue[head];
    if (index === grid.goal) return true;
    for (let dir = 0; dir < 4; dir++) {
      const next = stepTo(grid, index, dir as Dir);
      if (next < 0 || seen[next]) continue;
      seen[next] = 1;
      queue.push(next);
    }
  }
  return false;
}

/** 可通行的格子数 —— 状态空间是它的四倍 */
export function openCells(grid: TurnGrid) {
  let count = 0;
  for (let i = 0; i < grid.walls.length; i++) if (grid.walls[i] === 0) count++;
  return count;
}
