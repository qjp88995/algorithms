import {
  edgeGeometry,
  type GraphViewport,
  nodeX,
  nodeY,
} from '@/lib/graph/geometry';
import { findEdge, nodeName } from '@/lib/graph/model';

import { DAY, FLASH_FRAMES, roadColors } from './constants';
import type { FastestPathRun } from './fastest';
import {
  congestion,
  formatClock,
  phaseOf,
  type RoadNetwork,
  travelTime,
} from './network';
import type { ProfileSample } from './types';

/** 一条被画出来的路线 */
export interface Route {
  path: number[];
  /** 路线上每个节点的到达时刻，跑车动画照着它走 */
  times: number[];
}

export interface RenderParams {
  network: RoadNetwork;
  run: FastestPathRun | null;
  view: GraphViewport;
  width: number;
  height: number;
  source: number;
  target: number;
  /** 画面当前的时刻：发车动画在走时是车上的钟，否则就是出发时刻 */
  clock: number;
  /** 松弛成功后的余晖：边下标 → 剩余帧数 */
  flashes: Map<number, number>;
  fast: Route | null;
  staticRoute: Route | null;
  /** 多标签搜索找到的更早路线；Dijkstra 已经最优时为空 */
  better: number[];
  /** 是否在跑发车动画 */
  racing: boolean;
}

const MONO = 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace';

export function renderScene(
  ctx: CanvasRenderingContext2D,
  params: RenderParams
) {
  ctx.fillStyle = roadColors.background;
  ctx.fillRect(0, 0, params.width, params.height);

  drawRoads(ctx, params);
  drawRoute(ctx, params, params.better, roadColors.routeBest, 5, true);
  drawRoute(
    ctx,
    params,
    params.staticRoute?.path ?? [],
    roadColors.routeStatic,
    4
  );
  drawRoute(ctx, params, params.fast?.path ?? [], roadColors.routeFast, 4);
  drawSearch(ctx, params);
  drawNodes(ctx, params);
  drawCars(ctx, params);
  drawClock(ctx, params);
}

/**
 * 路网本身。每条路的颜色就是它此刻的拥堵程度 ——
 * 拖动出发时刻滑块时整张图会跟着"呼吸"，早晚高峰一眼就能看出来。
 */
function drawRoads(ctx: CanvasRenderingContext2D, params: RenderParams) {
  const { network, view, clock } = params;
  const fontSize = clamp(Math.round(view.radius * 0.55), 8, 11);

  network.graph.edges.forEach((edge, index) => {
    if (index > edge.reverse) return;

    const geometry = edgeGeometry(network.graph, view, index, 0, 2);
    const road = network.edges[index];
    const closed = road.openAt >= 0 && phaseOf(clock) < road.openAt;
    // 归一化成 0…1：rush 只决定强度，颜色要表达的是"这条路堵到什么程度"
    const ratio = network.rush
      ? clamp(congestion(network, index, clock) / network.rush, 0, 1)
      : 0;

    ctx.strokeStyle = closed
      ? roadColors.closed
      : mixColor(roadColors.free, roadColors.jammed, ratio);
    ctx.lineWidth = 1.5 + ratio * 2.5;
    if (closed) ctx.setLineDash([6, 4]);
    ctx.beginPath();
    ctx.moveTo(geometry.x1, geometry.y1);
    ctx.lineTo(geometry.x2, geometry.y2);
    ctx.stroke();
    ctx.setLineDash([]);

    const minutes = Math.round(travelTime(network, index, clock));
    drawPill(ctx, geometry.midX, geometry.midY, String(minutes), fontSize);
  });
}

function drawRoute(
  ctx: CanvasRenderingContext2D,
  params: RenderParams,
  path: number[],
  color: string,
  width: number,
  dashed = false
) {
  if (path.length < 2) return;
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.lineCap = 'round';
  if (dashed) ctx.setLineDash([9, 6]);
  for (let i = 1; i < path.length; i++) {
    const edge = findEdge(params.network.graph, path[i - 1], path[i]);
    if (edge >= 0) strokeEdge(ctx, params, edge);
  }
  ctx.setLineDash([]);
  ctx.lineCap = 'butt';
}

/** 搜索过程：刚松弛成功的边留下余晖，正在检查的那条画成白线 */
function drawSearch(ctx: CanvasRenderingContext2D, params: RenderParams) {
  const { run, flashes } = params;

  ctx.strokeStyle = roadColors.improved;
  ctx.lineWidth = 3.5;
  for (const [edge, remaining] of flashes) {
    ctx.globalAlpha = Math.min(1, remaining / FLASH_FRAMES);
    strokeEdge(ctx, params, edge);
  }
  ctx.globalAlpha = 1;

  if (!run || run.activeEdge < 0) return;
  ctx.strokeStyle = run.activeImproved
    ? roadColors.improved
    : roadColors.active;
  ctx.lineWidth = 4;
  strokeEdge(ctx, params, run.activeEdge);
}

function drawNodes(ctx: CanvasRenderingContext2D, params: RenderParams) {
  const { network, run, view, source, target } = params;
  const graph = network.graph;
  const labelSize = clamp(Math.round(view.radius * 0.75), 10, 15);
  const timeSize = clamp(Math.round(view.radius * 0.58), 9, 12);

  for (let node = 0; node < graph.nodes.length; node++) {
    const x = nodeX(graph, view, node);
    const y = nodeY(graph, view, node);

    ctx.fillStyle = nodeFill(params, node);
    ctx.beginPath();
    ctx.arc(x, y, view.radius, 0, Math.PI * 2);
    ctx.fill();

    const endpoint = node === source || node === target;
    ctx.strokeStyle = endpoint
      ? node === source
        ? roadColors.source
        : roadColors.target
      : roadColors.nodeStroke;
    ctx.lineWidth = endpoint ? 2.5 : 1.5;
    ctx.stroke();

    ctx.fillStyle = isBrightFill(params, node)
      ? roadColors.background
      : roadColors.label;
    ctx.font = `600 ${labelSize}px ${MONO}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(nodeName(node), x, y + 0.5);

    // 路口下面写钟点而不是"出发后第几分钟"：整页别处也都在讲几点几分
    if (!run) continue;
    const arrival = run.arrival[node];
    ctx.fillStyle = roadColors.time;
    ctx.font = `${timeSize}px ${MONO}`;
    ctx.textBaseline = 'top';
    ctx.fillText(
      Number.isFinite(arrival) ? formatClock(arrival) : '—',
      x,
      y + view.radius + 3
    );
  }
}

function drawCars(ctx: CanvasRenderingContext2D, params: RenderParams) {
  if (!params.racing) return;
  const pairs: [Route | null, string][] = [
    [params.staticRoute, roadColors.carStatic],
    [params.fast, roadColors.carFast],
  ];
  for (const [route, color] of pairs) {
    if (!route) continue;
    const point = positionAt(params, route);
    if (!point) continue;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(
      point.x,
      point.y,
      Math.max(4, params.view.radius * 0.38),
      0,
      Math.PI * 2
    );
    ctx.fill();
  }
}

/** 车此刻在路线上的哪个位置；路线为空返回 null */
function positionAt(params: RenderParams, route: Route) {
  const { network, view, clock } = params;
  const { path, times } = route;
  if (path.length === 0 || times.length !== path.length) return null;

  let index = 0;
  while (index < times.length - 1 && clock >= times[index + 1]) index++;
  const ax = nodeX(network.graph, view, path[index]);
  const ay = nodeY(network.graph, view, path[index]);
  if (index >= path.length - 1) return { x: ax, y: ay };

  const span = times[index + 1] - times[index] || 1;
  const t = clamp((clock - times[index]) / span, 0, 1);
  return {
    x: ax + (nodeX(network.graph, view, path[index + 1]) - ax) * t,
    y: ay + (nodeY(network.graph, view, path[index + 1]) - ay) * t,
  };
}

function drawClock(ctx: CanvasRenderingContext2D, params: RenderParams) {
  ctx.fillStyle = roadColors.clock;
  ctx.font = `600 ${Math.round(params.view.radius * 0.95)}px ${MONO}`;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.fillText(formatClock(params.clock), 10, 8);
}

function nodeFill(params: RenderParams, node: number) {
  const { run, source, target } = params;
  if (node === source) return roadColors.source;
  if (node === target) return roadColors.target;
  if (run?.cursor === node) return roadColors.nodeActive;
  if (run?.settled[node]) return roadColors.nodeSettled;
  if (run && Number.isFinite(run.arrival[node])) return roadColors.nodeReached;
  return roadColors.node;
}

function isBrightFill(params: RenderParams, node: number) {
  const { run, source, target } = params;
  return node === source || node === target || run?.cursor === node;
}

function strokeEdge(
  ctx: CanvasRenderingContext2D,
  params: RenderParams,
  edge: number
) {
  const geometry = edgeGeometry(params.network.graph, params.view, edge, 0, 2);
  ctx.beginPath();
  ctx.moveTo(geometry.x1, geometry.y1);
  ctx.lineTo(geometry.x2, geometry.y2);
  ctx.stroke();
}

function drawPill(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  text: string,
  fontSize: number
) {
  ctx.font = `${fontSize}px ${MONO}`;
  const boxWidth = ctx.measureText(text).width + 5;
  ctx.fillStyle = roadColors.background;
  ctx.fillRect(
    x - boxWidth / 2,
    y - (fontSize + 2.5) / 2,
    boxWidth,
    fontSize + 2.5
  );
  ctx.fillStyle = roadColors.edgeLabel;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, x, y + 0.5);
}

// ─── 到达曲线 ───────────────────────────────────────────────

export interface ProfileParams {
  samples: ProfileSample[];
  departure: number;
  width: number;
  height: number;
}

/**
 * 「几点出发 → 要走多久」这条曲线。
 *
 * 红色的那几段是 FIFO 违例：晚出发一分钟，到达时刻反而提前了。
 * 平滑的潮汐拥堵永远画不出这种段落 —— 它只会让曲线在高峰处鼓起一个包。
 */
export function renderProfile(
  ctx: CanvasRenderingContext2D,
  params: ProfileParams
) {
  const { samples, width, height } = params;
  ctx.fillStyle = roadColors.background;
  ctx.fillRect(0, 0, width, height);
  if (samples.length < 2) return;

  const padLeft = 30;
  const padRight = 8;
  const padTop = 12;
  const padBottom = 14;
  const plotWidth = Math.max(1, width - padLeft - padRight);
  const plotHeight = Math.max(1, height - padTop - padBottom);

  const durations = samples
    .map(sample => sample.duration)
    .filter(Number.isFinite);
  if (durations.length === 0) return;
  const low = Math.min(...durations);
  const high = Math.max(...durations);
  const span = high - low || 1;

  const toX = (minute: number) => padLeft + (minute / DAY) * plotWidth;
  const toY = (duration: number) =>
    padTop + plotHeight - ((duration - low) / span) * plotHeight;

  // 每 6 小时一条竖线，读得出早晚高峰各在哪
  ctx.strokeStyle = roadColors.profileGrid;
  ctx.lineWidth = 1;
  ctx.font = `9px ${MONO}`;
  ctx.fillStyle = roadColors.edgeLabel;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  for (let hour = 0; hour <= 24; hour += 6) {
    const x = toX(hour * 60);
    ctx.beginPath();
    ctx.moveTo(x, padTop);
    ctx.lineTo(x, padTop + plotHeight);
    ctx.stroke();
    ctx.fillText(`${hour}:00`, x, padTop + plotHeight + 3);
  }

  ctx.textAlign = 'right';
  ctx.textBaseline = 'middle';
  ctx.fillText(`${Math.round(high)}`, padLeft - 4, toY(high));
  ctx.fillText(`${Math.round(low)}`, padLeft - 4, toY(low));

  ctx.lineWidth = 2;
  ctx.lineCap = 'round';
  for (let i = 1; i < samples.length; i++) {
    // 终点不可达的采样点直接跳过，否则一个 Infinity 会把整条曲线拉没
    if (!Number.isFinite(samples[i].duration)) continue;
    if (!Number.isFinite(samples[i - 1].duration)) continue;
    // 到达时刻反而提前 —— 这一段就是 FIFO 违例
    const violation = samples[i].arrival < samples[i - 1].arrival - 1e-9;
    ctx.strokeStyle = violation
      ? roadColors.profileViolation
      : roadColors.profileLine;
    ctx.lineWidth = violation ? 3 : 2;
    ctx.beginPath();
    ctx.moveTo(toX(samples[i - 1].departure), toY(samples[i - 1].duration));
    ctx.lineTo(toX(samples[i].departure), toY(samples[i].duration));
    ctx.stroke();
  }
  ctx.lineCap = 'butt';

  const markerX = toX(phaseOf(params.departure));
  ctx.strokeStyle = roadColors.profileMarker;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(markerX, padTop - 4);
  ctx.lineTo(markerX, padTop + plotHeight);
  ctx.stroke();
}

function mixColor(from: string, to: string, t: number) {
  const a = parseHex(from);
  const b = parseHex(to);
  const channel = (index: number) =>
    Math.round(a[index] + (b[index] - a[index]) * t);
  return `rgb(${channel(0)}, ${channel(1)}, ${channel(2)})`;
}

function parseHex(hex: string): [number, number, number] {
  const value = parseInt(hex.slice(1), 16);
  return [(value >> 16) & 255, (value >> 8) & 255, value & 255];
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}
