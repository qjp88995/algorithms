import { turnColors } from './constants';
import { DX, DY, isWall, xOf, yOf } from './grid';
import type { TurnRun } from './turn';
import type { Dir, TurnGrid } from './types';

/** 网格铺在画布上的换算：格子边长与左上角偏移 */
export interface GridViewport {
  cell: number;
  offsetX: number;
  offsetY: number;
}

export function computeViewport(
  grid: TurnGrid,
  width: number,
  height: number
): GridViewport {
  const cell = Math.max(
    4,
    Math.floor(Math.min(width / grid.cols, height / grid.rows))
  );
  return {
    cell,
    offsetX: Math.floor((width - cell * grid.cols) / 2),
    offsetY: Math.floor((height - cell * grid.rows) / 2),
  };
}

/** 像素坐标落在哪个格子上；出界返回 -1 */
export function cellAt(
  grid: TurnGrid,
  view: GridViewport,
  px: number,
  py: number
) {
  const x = Math.floor((px - view.offsetX) / view.cell);
  const y = Math.floor((py - view.offsetY) / view.cell);
  if (x < 0 || y < 0 || x >= grid.cols || y >= grid.rows) return -1;
  return y * grid.cols + x;
}

/** 画出来的一条路线 */
export interface Route {
  cells: number[];
  color: string;
  width: number;
  dashed?: boolean;
}

export interface RenderParams {
  grid: TurnGrid;
  run: TurnRun | null;
  view: GridViewport;
  width: number;
  height: number;
  startDir: Dir;
  /** 跑完之后才有；顺序决定谁盖在谁上面 */
  routes: Route[];
  /** 是否画出四分格的状态空间 */
  showStates: boolean;
}

export function renderScene(
  ctx: CanvasRenderingContext2D,
  params: RenderParams
) {
  ctx.fillStyle = turnColors.background;
  ctx.fillRect(0, 0, params.width, params.height);

  drawCells(ctx, params);
  if (params.showStates) drawStates(ctx, params);
  drawCursor(ctx, params);
  for (const route of params.routes) drawRoute(ctx, params, route);
  drawEndpoints(ctx, params);
}

function drawCells(ctx: CanvasRenderingContext2D, params: RenderParams) {
  const { grid, view } = params;
  for (let index = 0; index < grid.walls.length; index++) {
    const x = view.offsetX + xOf(grid, index) * view.cell;
    const y = view.offsetY + yOf(grid, index) * view.cell;
    ctx.fillStyle = isWall(grid, index) ? turnColors.wall : turnColors.floor;
    ctx.fillRect(x, y, view.cell, view.cell);
  }

  ctx.strokeStyle = turnColors.gridLine;
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let col = 0; col <= grid.cols; col++) {
    const x = view.offsetX + col * view.cell + 0.5;
    ctx.moveTo(x, view.offsetY);
    ctx.lineTo(x, view.offsetY + grid.rows * view.cell);
  }
  for (let row = 0; row <= grid.rows; row++) {
    const y = view.offsetY + row * view.cell + 0.5;
    ctx.moveTo(view.offsetX, y);
    ctx.lineTo(view.offsetX + grid.cols * view.cell, y);
  }
  ctx.stroke();
}

/**
 * 每个格子切成四个三角，一个三角就是一个状态：朝右的那一半在右边，
 * 朝上的在上边，以此类推。
 *
 * 这是整页最该看的一幕 —— 同一个格子的四个朝向会在不同时刻分别定稿，
 * 有的格子四个方向全亮，有的只亮一两个。普通网格寻路里每格只有一个
 * 格子状态，这里凭空多出了三倍。
 */
function drawStates(ctx: CanvasRenderingContext2D, params: RenderParams) {
  const { grid, run, view } = params;
  if (!run) return;
  const total = Math.max(1, run.expanded);

  for (let index = 0; index < grid.walls.length; index++) {
    if (isWall(grid, index)) continue;
    const left = view.offsetX + xOf(grid, index) * view.cell;
    const top = view.offsetY + yOf(grid, index) * view.cell;

    for (let dir = 0; dir < 4; dir++) {
      const state = index * 4 + dir;
      const settled = run.settled[state] === 1;
      if (!settled && !Number.isFinite(run.dist[state])) continue;

      ctx.fillStyle = settled
        ? mixColor(
            turnColors.waveFrom,
            turnColors.waveTo,
            run.order[state] / total
          )
        : turnColors.open;
      wedgePath(ctx, left, top, view.cell, dir as Dir);
      ctx.fill();
    }
  }
}

/** 格子里朝某个方向的那个三角：中心 + 对应的那条外边 */
function wedgePath(
  ctx: CanvasRenderingContext2D,
  left: number,
  top: number,
  size: number,
  dir: Dir
) {
  const right = left + size;
  const bottom = top + size;
  const corners: [number, number][][] = [
    [
      [right, top],
      [right, bottom],
    ],
    [
      [right, bottom],
      [left, bottom],
    ],
    [
      [left, bottom],
      [left, top],
    ],
    [
      [left, top],
      [right, top],
    ],
  ];

  ctx.beginPath();
  ctx.moveTo(left + size / 2, top + size / 2);
  for (const [x, y] of corners[dir]) ctx.lineTo(x, y);
  ctx.closePath();
}

/** 正在展开的那个状态：描白边的三角 */
function drawCursor(ctx: CanvasRenderingContext2D, params: RenderParams) {
  const { grid, run, view } = params;
  if (!run || run.cursor < 0 || !params.showStates) return;

  const cell = run.cursor >> 2;
  wedgePath(
    ctx,
    view.offsetX + xOf(grid, cell) * view.cell,
    view.offsetY + yOf(grid, cell) * view.cell,
    view.cell,
    (run.cursor & 3) as Dir
  );
  ctx.strokeStyle = turnColors.active;
  ctx.lineWidth = 1.5;
  ctx.stroke();
}

/**
 * 一条路线，外加它每个转弯处的标记。
 *
 * 标记不是装饰：这一页比的就是「多走两步」和「少转两个弯」哪个划算，
 * 数得清弯，这笔账才看得懂。
 */
function drawRoute(
  ctx: CanvasRenderingContext2D,
  params: RenderParams,
  route: Route
) {
  const { grid, view } = params;
  if (route.cells.length < 2) return;
  const half = view.cell / 2;
  const cx = (cell: number) =>
    view.offsetX + xOf(grid, cell) * view.cell + half;
  const cy = (cell: number) =>
    view.offsetY + yOf(grid, cell) * view.cell + half;

  ctx.strokeStyle = route.color;
  ctx.lineWidth = route.width;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  if (route.dashed) ctx.setLineDash([route.width * 1.6, route.width * 1.4]);
  ctx.beginPath();
  ctx.moveTo(cx(route.cells[0]), cy(route.cells[0]));
  for (let i = 1; i < route.cells.length; i++) {
    ctx.lineTo(cx(route.cells[i]), cy(route.cells[i]));
  }
  ctx.stroke();
  ctx.setLineDash([]);

  ctx.fillStyle = route.color;
  for (let i = 1; i < route.cells.length - 1; i++) {
    const before = heading(grid, route.cells[i - 1], route.cells[i]);
    const after = heading(grid, route.cells[i], route.cells[i + 1]);
    if (before === after) continue;
    ctx.beginPath();
    ctx.arc(
      cx(route.cells[i]),
      cy(route.cells[i]),
      route.width * 0.75,
      0,
      Math.PI * 2
    );
    ctx.fill();
  }
  ctx.lineCap = 'butt';
  ctx.lineJoin = 'miter';
}

function heading(grid: TurnGrid, from: number, to: number) {
  const dx = xOf(grid, to) - xOf(grid, from);
  return dx !== 0 ? (dx > 0 ? 0 : 2) : yOf(grid, to) > yOf(grid, from) ? 1 : 3;
}

/** 起点画一个指向初始朝向的箭头，终点画一个圈 */
function drawEndpoints(ctx: CanvasRenderingContext2D, params: RenderParams) {
  const { grid, view, startDir } = params;
  const half = view.cell / 2;
  const sx = view.offsetX + xOf(grid, grid.start) * view.cell + half;
  const sy = view.offsetY + yOf(grid, grid.start) * view.cell + half;
  const gx = view.offsetX + xOf(grid, grid.goal) * view.cell + half;
  const gy = view.offsetY + yOf(grid, grid.goal) * view.cell + half;

  ctx.fillStyle = turnColors.start;
  ctx.beginPath();
  ctx.arc(sx, sy, half * 0.55, 0, Math.PI * 2);
  ctx.fill();

  // 车头朝哪，这一页的第一次转弯就从这里算起
  const reach = half * 1.15;
  const tipX = sx + DX[startDir] * reach;
  const tipY = sy + DY[startDir] * reach;
  const wing = half * 0.5;
  ctx.strokeStyle = turnColors.start;
  ctx.lineWidth = Math.max(1.5, view.cell * 0.1);
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(sx, sy);
  ctx.lineTo(tipX, tipY);
  ctx.moveTo(tipX, tipY);
  ctx.lineTo(
    tipX - DX[startDir] * wing - DY[startDir] * wing * 0.8,
    tipY - DY[startDir] * wing + DX[startDir] * wing * 0.8
  );
  ctx.moveTo(tipX, tipY);
  ctx.lineTo(
    tipX - DX[startDir] * wing + DY[startDir] * wing * 0.8,
    tipY - DY[startDir] * wing - DX[startDir] * wing * 0.8
  );
  ctx.stroke();
  ctx.lineCap = 'butt';

  ctx.strokeStyle = turnColors.goal;
  ctx.lineWidth = Math.max(2, view.cell * 0.14);
  ctx.beginPath();
  ctx.arc(gx, gy, half * 0.62, 0, Math.PI * 2);
  ctx.stroke();
}

function mixColor(from: string, to: string, t: number) {
  const ratio = Math.min(1, Math.max(0, t));
  const a = parseHex(from);
  const b = parseHex(to);
  const channel = (index: number) =>
    Math.round(a[index] + (b[index] - a[index]) * ratio);
  return `rgb(${channel(0)}, ${channel(1)}, ${channel(2)})`;
}

function parseHex(hex: string): [number, number, number] {
  const value = parseInt(hex.slice(1), 16);
  return [(value >> 16) & 255, (value >> 8) & 255, value & 255];
}
