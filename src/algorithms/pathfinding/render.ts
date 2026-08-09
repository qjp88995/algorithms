import { gridColors } from './constants';
import { isSwamp, isWall, xOf, yOf } from './grid';
import type { PathSearch } from './search';
import { type GridModel, NODE_CLOSED, NODE_OPEN } from './types';

export interface Viewport {
  cellSize: number;
  offsetX: number;
  offsetY: number;
}

/** 网格按容器等比缩放并居中，返回像素与格子的换算参数 */
export function computeViewport(
  grid: GridModel,
  width: number,
  height: number
): Viewport {
  const cellSize = Math.max(
    2,
    Math.floor(Math.min(width / grid.cols, height / grid.rows))
  );
  return {
    cellSize,
    offsetX: Math.floor((width - cellSize * grid.cols) / 2),
    offsetY: Math.floor((height - cellSize * grid.rows) / 2),
  };
}

/** 像素坐标 → 格子下标，落在网格外返回 -1 */
export function cellAt(
  grid: GridModel,
  viewport: Viewport,
  px: number,
  py: number
): number {
  const x = Math.floor((px - viewport.offsetX) / viewport.cellSize);
  const y = Math.floor((py - viewport.offsetY) / viewport.cellSize);
  if (x < 0 || y < 0 || x >= grid.cols || y >= grid.rows) return -1;
  return y * grid.cols + x;
}

export function renderGrid(
  ctx: CanvasRenderingContext2D,
  grid: GridModel,
  search: PathSearch | null,
  path: number[],
  width: number,
  height: number,
  viewport: Viewport
) {
  ctx.fillStyle = gridColors.background;
  ctx.fillRect(0, 0, width, height);

  const { cellSize, offsetX, offsetY } = viewport;
  // 展开顺序归一化后用于着色，能看出搜索的波前是怎么推进的
  const expanded = search ? Math.max(search.stats().expanded, 1) : 1;

  for (let index = 0; index < grid.walls.length; index++) {
    const x = offsetX + xOf(grid, index) * cellSize;
    const y = offsetY + yOf(grid, index) * cellSize;

    ctx.fillStyle = cellColor(grid, search, index, expanded);
    ctx.fillRect(x, y, cellSize, cellSize);

    if (cellSize >= 6) {
      ctx.strokeStyle = gridColors.line;
      ctx.lineWidth = 1;
      ctx.strokeRect(x + 0.5, y + 0.5, cellSize - 1, cellSize - 1);
    }
  }

  drawPath(ctx, grid, path, viewport);
  drawEndpoint(ctx, grid, grid.start, gridColors.start, viewport);
  drawEndpoint(ctx, grid, grid.goal, gridColors.goal, viewport);
}

function cellColor(
  grid: GridModel,
  search: PathSearch | null,
  index: number,
  expanded: number
): string {
  if (isWall(grid, index)) return gridColors.wall;

  if (search) {
    const state = search.state[index];
    if (state === NODE_CLOSED) {
      const order = search.order[index];
      const t = order < 0 ? 0 : order / expanded;
      return mixHex(gridColors.closedFrom, gridColors.closedTo, t);
    }
    if (state === NODE_OPEN) return gridColors.open;
  }

  if (isSwamp(grid, index)) return gridColors.swamp;
  return gridColors.cell;
}

/** 路径画成一条连续折线，比逐格填色更能看清走向 */
function drawPath(
  ctx: CanvasRenderingContext2D,
  grid: GridModel,
  path: number[],
  { cellSize, offsetX, offsetY }: Viewport
) {
  if (path.length < 2) return;

  ctx.strokeStyle = gridColors.path;
  ctx.lineWidth = Math.max(2, cellSize * 0.3);
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  ctx.beginPath();
  path.forEach((index, i) => {
    const x = offsetX + (xOf(grid, index) + 0.5) * cellSize;
    const y = offsetY + (yOf(grid, index) + 0.5) * cellSize;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });
  ctx.stroke();
}

function drawEndpoint(
  ctx: CanvasRenderingContext2D,
  grid: GridModel,
  index: number,
  color: string,
  { cellSize, offsetX, offsetY }: Viewport
) {
  const x = offsetX + (xOf(grid, index) + 0.5) * cellSize;
  const y = offsetY + (yOf(grid, index) + 0.5) * cellSize;
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(x, y, Math.max(3, cellSize * 0.36), 0, Math.PI * 2);
  ctx.fill();
}

/** 两个 #rrggbb 之间线性插值 */
function mixHex(from: string, to: string, t: number): string {
  const clamped = t < 0 ? 0 : t > 1 ? 1 : t;
  const a = parseInt(from.slice(1), 16);
  const b = parseInt(to.slice(1), 16);
  const mix = (shift: number) => {
    const av = (a >> shift) & 0xff;
    const bv = (b >> shift) & 0xff;
    return Math.round(av + (bv - av) * clamped);
  };
  return `rgb(${mix(16)}, ${mix(8)}, ${mix(0)})`;
}
