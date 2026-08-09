import { MARK_ACTIVE, type MazeGenerator } from '@/lib/maze/generators';
import { type MazeGrid, xOf, yOf } from '@/lib/maze/grid';

import { componentColor, mazeColors } from './constants';

export interface Viewport {
  cellSize: number;
  offsetX: number;
  offsetY: number;
}

/** 网格等比缩放并居中 */
export function computeViewport(
  grid: MazeGrid,
  width: number,
  height: number
): Viewport {
  const cellSize = Math.max(
    1,
    Math.floor(Math.min(width / grid.cols, height / grid.rows))
  );
  return {
    cellSize,
    offsetX: Math.floor((width - cellSize * grid.cols) / 2),
    offsetY: Math.floor((height - cellSize * grid.rows) / 2),
  };
}

/**
 * 一层画完：墙、通道、活跃集合、游标。
 *
 * 这里不做寻路那种静态层/覆盖层拆分 —— 那边是搜索停下后光点还在跑，
 * 才值得把不变的部分缓存起来；生成过程一停画面就彻底不动了。
 */
export function renderMaze(
  ctx: CanvasRenderingContext2D,
  grid: MazeGrid,
  generator: MazeGenerator | null,
  width: number,
  height: number,
  viewport: Viewport
) {
  ctx.fillStyle = mazeColors.background;
  ctx.fillRect(0, 0, width, height);

  const { cellSize, offsetX, offsetY } = viewport;
  const components = generator?.showsComponents ?? false;

  for (let index = 0; index < grid.walls.length; index++) {
    const x = offsetX + xOf(grid, index) * cellSize;
    const y = offsetY + yOf(grid, index) * cellSize;

    if (grid.walls[index] === 1) {
      ctx.fillStyle = mazeColors.wall;
    } else if (generator?.mark[index] === MARK_ACTIVE) {
      ctx.fillStyle = mazeColors.active;
    } else if (components && generator) {
      // Kruskal：同色即已连通，画面于是变成一群斑块相互吞并
      ctx.fillStyle = componentColor(generator.componentOf(index));
    } else {
      ctx.fillStyle = mazeColors.cell;
    }
    ctx.fillRect(x, y, cellSize, cellSize);
  }

  drawCursor(ctx, grid, generator?.cursor ?? -1, viewport);
}

/** 正在操作的那一格。描边而不填色，免得盖掉它自己的状态色 */
function drawCursor(
  ctx: CanvasRenderingContext2D,
  grid: MazeGrid,
  index: number,
  { cellSize, offsetX, offsetY }: Viewport
) {
  if (index < 0) return;
  const width = Math.max(1, cellSize * 0.24);
  const x = offsetX + xOf(grid, index) * cellSize;
  const y = offsetY + yOf(grid, index) * cellSize;
  ctx.strokeStyle = mazeColors.cursor;
  ctx.lineWidth = width;
  ctx.strokeRect(
    x + width / 2,
    y + width / 2,
    cellSize - width,
    cellSize - width
  );
}
