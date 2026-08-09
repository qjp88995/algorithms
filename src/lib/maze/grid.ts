/**
 * 迷宫用的最小网格。
 *
 * 和寻路那份 `GridModel` 的区别是这里没有权重、没有起终点 —— 生成迷宫
 * 只关心"哪里是墙"。寻路的 `GridModel` 结构上是这个接口的超集，
 * 所以它可以直接把自己的网格交给这里的生成器。
 *
 * 布局约定：**奇数坐标是通道格，偶数坐标是墙**。生成时在通道格之间
 * 跳两格前进，打通中间那格 —— 墙因此有厚度，迷宫才有形。
 */
export interface MazeGrid {
  cols: number;
  rows: number;
  /** 1 = 墙 */
  walls: Uint8Array;
}

export function createMazeGrid(cols: number, rows: number): MazeGrid {
  return {
    cols,
    rows,
    walls: new Uint8Array(cols * rows).fill(1),
  };
}

export function xOf(grid: MazeGrid, index: number) {
  return index % grid.cols;
}

export function yOf(grid: MazeGrid, index: number) {
  return Math.floor(index / grid.cols);
}

export function indexOf(grid: MazeGrid, x: number, y: number) {
  return y * grid.cols + x;
}

/** 通道格必须落在奇数坐标，且不能贴着最外圈 —— 外圈要留作围墙 */
export function isCellSlot(grid: MazeGrid, x: number, y: number) {
  return (
    x % 2 === 1 &&
    y % 2 === 1 &&
    x > 0 &&
    y > 0 &&
    x < grid.cols - 1 &&
    y < grid.rows - 1
  );
}

/** 网格能容纳多少个通道格 */
export function cellCount(grid: MazeGrid) {
  return Math.floor((grid.cols - 1) / 2) * Math.floor((grid.rows - 1) / 2);
}

/** 遍历全部通道格的下标 */
export function eachCell(grid: MazeGrid, visit: (index: number) => void) {
  for (let y = 1; y < grid.rows - 1; y += 2) {
    for (let x = 1; x < grid.cols - 1; x += 2) {
      visit(indexOf(grid, x, y));
    }
  }
}

/** 四个方向上隔一格的邻居（也就是相邻通道格），写进 out，返回个数 */
export function cellNeighbors(
  grid: MazeGrid,
  index: number,
  out: Int32Array
): number {
  const x = xOf(grid, index);
  const y = yOf(grid, index);
  let count = 0;
  const steps: [number, number][] = [
    [0, -2],
    [2, 0],
    [0, 2],
    [-2, 0],
  ];
  for (const [dx, dy] of steps) {
    const nx = x + dx;
    const ny = y + dy;
    if (!isCellSlot(grid, nx, ny)) continue;
    out[count++] = indexOf(grid, nx, ny);
  }
  return count;
}

/** 两个相邻通道格中间那一格 —— 打通它们就是打通这堵墙 */
export function wallBetween(grid: MazeGrid, a: number, b: number) {
  const x = (xOf(grid, a) + xOf(grid, b)) / 2;
  const y = (yOf(grid, a) + yOf(grid, b)) / 2;
  return indexOf(grid, x, y);
}

/** 数死胡同：只有一个通道邻居的格子。生成算法的"手感"差异主要体现在这里 */
export function countDeadEnds(grid: MazeGrid) {
  const buffer = new Int32Array(4);
  let total = 0;
  eachCell(grid, index => {
    if (grid.walls[index] === 1) return;
    const count = cellNeighbors(grid, index, buffer);
    let open = 0;
    for (let i = 0; i < count; i++) {
      if (grid.walls[wallBetween(grid, index, buffer[i])] === 0) open++;
    }
    if (open === 1) total++;
  });
  return total;
}
