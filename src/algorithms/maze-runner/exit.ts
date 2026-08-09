import { indexOf, type MazeGrid, xOf, yOf } from '@/lib/maze/grid';

const DELTAS: [number, number][] = [
  [0, -1],
  [1, 0],
  [0, 1],
  [-1, 0],
];

/**
 * 挑一个出口。
 *
 * 不能纯随机：随便落一格的话，相当一部分情况下出口就在起点旁边，
 * 四种走法几步都到了，对比也就没了。所以先从起点做一次泛洪量出每格
 * 的真实距离 —— 迷宫是树，任意两格路径唯一，这个距离就是那条唯一
 * 路径的长度 —— 再从最远的那一批里随机挑一个。
 *
 * 位置随机还带出一件本来看不到的事：**扶墙法的表现强烈依赖出口在哪**。
 * 出口贴着外墙时它几乎直达，缩在树的深处时它可能得把大半棵树蹭一遍。
 * 出口钉死在右下角的时候，这个变化被永远藏起来了。
 */
export function pickExit(
  grid: MazeGrid,
  start: number,
  random: () => number
): number {
  const distance = floodFrom(grid, start);

  let farthest = 0;
  for (let i = 0; i < distance.length; i++) {
    if (distance[i] > farthest) farthest = distance[i];
  }

  // 只在最远的那一档里挑，保证走一趟是有分量的
  const threshold = farthest * FAR_RATIO;
  const candidates: number[] = [];
  for (let i = 0; i < distance.length; i++) {
    if (distance[i] >= threshold) candidates.push(i);
  }
  if (candidates.length === 0) return start;
  return candidates[Math.floor(random() * candidates.length)];
}

/** 出口至少要有最远距离的这个比例，越高越接近"最深处" */
export const FAR_RATIO = 0.75;

/** 从起点泛洪，返回每个可通行格到起点的步数；走不到的是 -1 */
export function floodFrom(grid: MazeGrid, start: number): Int32Array {
  const distance = new Int32Array(grid.walls.length).fill(-1);
  if (grid.walls[start] === 1) return distance;

  distance[start] = 0;
  const queue = [start];
  for (let head = 0; head < queue.length; head++) {
    const current = queue[head];
    const x = xOf(grid, current);
    const y = yOf(grid, current);
    for (const [dx, dy] of DELTAS) {
      const nx = x + dx;
      const ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= grid.cols || ny >= grid.rows) continue;
      const next = indexOf(grid, nx, ny);
      if (grid.walls[next] === 1 || distance[next] >= 0) continue;
      distance[next] = distance[current] + 1;
      queue.push(next);
    }
  }
  return distance;
}
