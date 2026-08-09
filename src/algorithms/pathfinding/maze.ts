import { clearTerrain, inBounds, indexOf, setSwamp } from './grid';
import type { GridModel } from './types';

/**
 * 递归回溯法生成迷宫（深度优先 + 随机邻居顺序）。
 *
 * 先把整张图填满墙，再从一个奇数坐标出发每次跳两格打通 ——
 * 隔一格留墙，隔一格挖通道，这样墙才有厚度、迷宫才有形。
 * 特点是通道细长、死胡同多，很适合用来看贪心最佳优先怎么撞进
 * 死胡同再退出来。
 */
export function generateMaze(
  grid: GridModel,
  random: () => number = Math.random
) {
  clearTerrain(grid);
  grid.walls.fill(1);

  const stack: number[] = [];
  const startCell = indexOf(grid, 1, 1);
  grid.walls[startCell] = 0;
  stack.push(startCell);

  const directions: [number, number][] = [
    [0, -2],
    [0, 2],
    [-2, 0],
    [2, 0],
  ];

  while (stack.length > 0) {
    const current = stack[stack.length - 1];
    const x = current % grid.cols;
    const y = Math.floor(current / grid.cols);

    const candidates: [number, number][] = [];
    for (const [dx, dy] of directions) {
      const nx = x + dx;
      const ny = y + dy;
      if (nx <= 0 || ny <= 0 || nx >= grid.cols - 1 || ny >= grid.rows - 1) {
        continue;
      }
      if (grid.walls[indexOf(grid, nx, ny)] === 1) candidates.push([nx, ny]);
    }

    if (candidates.length === 0) {
      stack.pop();
      continue;
    }

    const [nx, ny] = candidates[Math.floor(random() * candidates.length)];
    // 打通中间那格，否则两个通道之间还是隔着墙
    grid.walls[indexOf(grid, (x + nx) / 2, (y + ny) / 2)] = 0;
    const next = indexOf(grid, nx, ny);
    grid.walls[next] = 0;
    stack.push(next);
  }

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
