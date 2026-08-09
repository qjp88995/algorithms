import { type MazeGrid, xOf, yOf } from '@/lib/maze/grid';

import { runnerColors, TRAIL_CAP } from './constants';
import { type MazeRunner } from './runner';

export interface Viewport {
  cellSize: number;
  offsetX: number;
  offsetY: number;
}

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
 * 画面的主角是**没画出来的部分**。
 *
 * 没见过的格子一律是雾，无论那里是墙还是通道 —— 这才是第一人称：
 * 你不知道自己没去过的地方长什么样。关掉迷雾能看到完整迷宫，
 * 那是上帝视角的对照组，正好说明这一页和寻路页差在哪。
 */
export function renderRun(
  ctx: CanvasRenderingContext2D,
  grid: MazeGrid,
  runner: MazeRunner | null,
  fog: boolean,
  width: number,
  height: number,
  viewport: Viewport
) {
  ctx.fillStyle = runnerColors.background;
  ctx.fillRect(0, 0, width, height);

  const { cellSize, offsetX, offsetY } = viewport;

  for (let index = 0; index < grid.walls.length; index++) {
    const x = offsetX + xOf(grid, index) * cellSize;
    const y = offsetY + yOf(grid, index) * cellSize;

    ctx.fillStyle = cellColor(grid, runner, index, fog);
    ctx.fillRect(x, y, cellSize, cellSize);
  }

  if (runner) {
    // 出口只有被看见之后才画出来 —— 在此之前它对走的人是不存在的
    if (!fog || runner.seen[runner.goal] === 1) {
      dot(ctx, grid, runner.goal, runnerColors.goal, viewport);
    }
    dot(ctx, grid, runner.start, runnerColors.start, viewport);
    drawRunner(ctx, grid, runner, viewport);
  }
}

function cellColor(
  grid: MazeGrid,
  runner: MazeRunner | null,
  index: number,
  fog: boolean
): string {
  if (runner && fog && runner.seen[index] === 0) return runnerColors.fog;
  if (grid.walls[index] === 1) return runnerColors.wall;

  const visits = runner?.visits[index] ?? 0;
  if (visits === 0) return runnerColors.cell;

  // 踏过的次数决定颜色：越红说明在这儿白走得越多
  const heat = Math.min(visits - 1, TRAIL_CAP) / TRAIL_CAP;
  return css(mix(TRAIL_FROM, TRAIL_TO, heat));
}

/** 带朝向的三角形 —— 朝向是扶墙法唯一的状态，值得画出来 */
function drawRunner(
  ctx: CanvasRenderingContext2D,
  grid: MazeGrid,
  runner: MazeRunner,
  { cellSize, offsetX, offsetY }: Viewport
) {
  const cx = offsetX + (xOf(grid, runner.at) + 0.5) * cellSize;
  const cy = offsetY + (yOf(grid, runner.at) + 0.5) * cellSize;
  const radius = Math.max(2.5, cellSize * 0.42);
  const angle = (runner.facing - 1) * (Math.PI / 2);

  const glow = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius * 3);
  glow.addColorStop(0, 'rgba(255, 226, 122, 0.35)');
  glow.addColorStop(1, 'rgba(255, 226, 122, 0)');
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(cx, cy, radius * 3, 0, Math.PI * 2);
  ctx.fill();

  // 顶点朝正前方，另外两点收在斜后方，看着才像个箭头
  const back = 2.5;
  ctx.fillStyle = runnerColors.runner;
  ctx.beginPath();
  ctx.moveTo(cx + Math.cos(angle) * radius, cy + Math.sin(angle) * radius);
  ctx.lineTo(
    cx + Math.cos(angle + back) * radius * 0.8,
    cy + Math.sin(angle + back) * radius * 0.8
  );
  ctx.lineTo(
    cx + Math.cos(angle - back) * radius * 0.8,
    cy + Math.sin(angle - back) * radius * 0.8
  );
  ctx.closePath();
  ctx.fill();
}

function dot(
  ctx: CanvasRenderingContext2D,
  grid: MazeGrid,
  index: number,
  color: string,
  { cellSize, offsetX, offsetY }: Viewport
) {
  const x = offsetX + (xOf(grid, index) + 0.5) * cellSize;
  const y = offsetY + (yOf(grid, index) + 0.5) * cellSize;
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(x, y, Math.max(2, cellSize * 0.32), 0, Math.PI * 2);
  ctx.fill();
}

// ─── 颜色 ─────────────────────────────────────────────────────
type Rgb = [number, number, number];

function hexToRgb(hex: string): Rgb {
  const value = parseInt(hex.slice(1), 16);
  return [(value >> 16) & 0xff, (value >> 8) & 0xff, value & 0xff];
}

const TRAIL_FROM = hexToRgb(runnerColors.trailFrom);
const TRAIL_TO = hexToRgb(runnerColors.trailTo);

function mix(from: Rgb, to: Rgb, t: number): Rgb {
  const k = t < 0 ? 0 : t > 1 ? 1 : t;
  return [
    Math.round(from[0] + (to[0] - from[0]) * k),
    Math.round(from[1] + (to[1] - from[1]) * k),
    Math.round(from[2] + (to[2] - from[2]) * k),
  ];
}

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
