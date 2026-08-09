import { createGenerator } from '@/lib/maze/generators';

import { clearTerrain, inBounds, indexOf, setSwamp } from './grid';
import type { GridModel } from './types';

/**
 * 用递归回溯法铺一张迷宫地形。
 *
 * 生成器住在 `@/lib/maze`，因为迷宫生成本身也是一个演示页面；这里只是
 * 把它一次跑完当地形用。`GridModel` 结构上就是它要的 `MazeGrid`，
 * 直接交过去即可。
 *
 * 选递归回溯是因为它通道细长、拐弯多，最适合用来看贪心最佳优先
 * 怎么一头扎进死胡同再退出来。
 */
export function generateMaze(
  grid: GridModel,
  random: () => number = Math.random
) {
  clearTerrain(grid);
  createGenerator('backtracker', grid, random).runToEnd();
  carveOut(grid, grid.start);
  carveOut(grid, grid.goal);
}

/** 随机撒障碍：比迷宫更松散，适合看不同算法的扩张形状 */
export function scatterObstacles(
  grid: GridModel,
  density: number,
  swampRatio: number,
  random: () => number = Math.random
) {
  clearTerrain(grid);
  for (let i = 0; i < grid.walls.length; i++) {
    if (i === grid.start || i === grid.goal) continue;
    if (random() >= density) continue;
    if (random() < swampRatio) setSwamp(grid, i, true);
    else grid.walls[i] = 1;
  }
}

/** 保证某个格子及其四邻可通行，避免起点/终点被墙封死 */
function carveOut(grid: GridModel, index: number) {
  const x = index % grid.cols;
  const y = Math.floor(index / grid.cols);
  const around: [number, number][] = [
    [x, y],
    [x - 1, y],
    [x + 1, y],
    [x, y - 1],
    [x, y + 1],
  ];
  for (const [nx, ny] of around) {
    if (!inBounds(grid, nx, ny)) continue;
    grid.walls[indexOf(grid, nx, ny)] = 0;
  }
}
