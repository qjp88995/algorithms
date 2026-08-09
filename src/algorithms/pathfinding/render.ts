import { gridColors, PULSE_SPAN } from './constants';
import { isSwamp, isWall, xOf, yOf } from './grid';
import type { PathSearch } from './search';
import { type GridModel, NODE_CLOSED, NODE_OPEN } from './types';

export interface Viewport {
  cellSize: number;
  offsetX: number;
  offsetY: number;
}

/** 路径的两段动画：先从终点回溯揭示，再让光点沿着走 */
export interface PathAnimation {
  /** 已揭示的格数，从终点往起点长 */
  revealed: number;
  /** 光点在路径上的位置（浮点索引），< 0 表示还没开始走 */
  walker: number;
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

/**
 * 静态层：地形 + 搜索状态。只在搜索推进或地形变化时重画，
 * 搜索停下之后这一层就不动了，光点动画因此几乎不花成本。
 */
export function renderStaticLayer(
  ctx: CanvasRenderingContext2D,
  grid: GridModel,
  search: PathSearch | null,
  width: number,
  height: number,
  viewport: Viewport
) {
  ctx.fillStyle = gridColors.background;
  ctx.fillRect(0, 0, width, height);

  const { cellSize, offsetX, offsetY } = viewport;
  // 展开顺序归一化后用于着色，能看出搜索的波前是怎么推进的
  const expanded = search ? Math.max(search.stats().expanded, 1) : 1;
  const drawLines = cellSize >= 6;

  for (let index = 0; index < grid.walls.length; index++) {
    const x = offsetX + xOf(grid, index) * cellSize;
    const y = offsetY + yOf(grid, index) * cellSize;

    ctx.fillStyle = cellColor(grid, search, index, expanded);
    ctx.fillRect(x, y, cellSize, cellSize);

    if (drawLines) {
      ctx.strokeStyle = gridColors.line;
      ctx.lineWidth = 1;
      ctx.strokeRect(x + 0.5, y + 0.5, cellSize - 1, cellSize - 1);
    }
  }
}

/** 覆盖层：路径与行走光点，每帧都在变 */
export function renderOverlay(
  ctx: CanvasRenderingContext2D,
  grid: GridModel,
  path: number[],
  anim: PathAnimation,
  viewport: Viewport
) {
  drawPath(ctx, grid, path, anim.revealed, viewport);
  drawWalker(ctx, grid, path, anim, viewport);
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
      let color = mix(CLOSED_FROM, CLOSED_TO, t);
      // 刚展开的格子先亮一下再落回渐变色，波前于是有了"烧过去"的观感
      const age = order < 0 ? PULSE_SPAN : expanded - order;
      if (age < PULSE_SPAN) {
        color = mix(color, PULSE, (1 - age / PULSE_SPAN) * 0.55);
      }
      return css(color);
    }
    if (state === NODE_OPEN) return gridColors.open;
  }

  if (isSwamp(grid, index)) return gridColors.swamp;
  return gridColors.cell;
}

/**
 * 路径画成一条连续折线。`revealed` 控制从终点往起点揭示多少格 ——
 * 这段回溯正是 cameFrom 链被真正走了一遍的样子。
 */
function drawPath(
  ctx: CanvasRenderingContext2D,
  grid: GridModel,
  path: number[],
  revealed: number,
  { cellSize, offsetX, offsetY }: Viewport
) {
  const shown = Math.min(path.length, Math.floor(revealed));
  if (shown < 2) return;

  const from = path.length - shown;
  ctx.strokeStyle = gridColors.path;
  ctx.lineWidth = Math.max(2, cellSize * 0.3);
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  ctx.beginPath();
  for (let i = from; i < path.length; i++) {
    const x = offsetX + (xOf(grid, path[i]) + 0.5) * cellSize;
    const y = offsetY + (yOf(grid, path[i]) + 0.5) * cellSize;
    if (i === from) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.stroke();
}

/** 沿路径行走的光点：让"这条路能走通"这件事真的被看见 */
function drawWalker(
  ctx: CanvasRenderingContext2D,
  grid: GridModel,
  path: number[],
  anim: PathAnimation,
  { cellSize, offsetX, offsetY }: Viewport
) {
  if (anim.walker < 0 || path.length < 2) return;

  const at = Math.min(anim.walker, path.length - 1);
  const i = Math.floor(at);
  const t = at - i;
  const a = path[i];
  const b = path[Math.min(i + 1, path.length - 1)];

  const x =
    offsetX +
    (xOf(grid, a) + (xOf(grid, b) - xOf(grid, a)) * t + 0.5) * cellSize;
  const y =
    offsetY +
    (yOf(grid, a) + (yOf(grid, b) - yOf(grid, a)) * t + 0.5) * cellSize;

  const radius = Math.max(3, cellSize * 0.38);
  const glow = ctx.createRadialGradient(x, y, 0, x, y, radius * 2.6);
  glow.addColorStop(0, 'rgba(255, 243, 196, 0.45)');
  glow.addColorStop(1, 'rgba(255, 243, 196, 0)');
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(x, y, radius * 2.6, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = gridColors.walker;
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.fill();
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

// ─── 颜色 ─────────────────────────────────────────────────────
type Rgb = [number, number, number];

function hexToRgb(hex: string): Rgb {
  const value = parseInt(hex.slice(1), 16);
  return [(value >> 16) & 0xff, (value >> 8) & 0xff, value & 0xff];
}

const CLOSED_FROM = hexToRgb(gridColors.closedFrom);
const CLOSED_TO = hexToRgb(gridColors.closedTo);
const PULSE = hexToRgb(gridColors.pulse);

function mix(from: Rgb, to: Rgb, t: number): Rgb {
  const k = t < 0 ? 0 : t > 1 ? 1 : t;
  return [
    Math.round(from[0] + (to[0] - from[0]) * k),
    Math.round(from[1] + (to[1] - from[1]) * k),
    Math.round(from[2] + (to[2] - from[2]) * k),
  ];
}

/**
 * 渐变色只有有限几百种，缓存起来省掉每格一次字符串拼接
 * （一块画布 1300 多格，四路对比再乘四）。
 */
const cssCache = new Map<number, string>();

function css([r, g, b]: Rgb): string {
  const key = (r << 16) | (g << 8) | b;
  let value = cssCache.get(key);
  if (value === undefined) {
    value = `rgb(${r},${g},${b})`;
    cssCache.set(key, value);
  }
  return value;
}
