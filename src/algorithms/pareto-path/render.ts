import {
  edgeGeometry,
  type GraphViewport,
  nodeX,
  nodeY,
} from '@/lib/graph/geometry';
import { findEdge, nodeName } from '@/lib/graph/model';

import { FLASH_FRAMES, paretoColors } from './constants';
import type { TollNetwork } from './network';
import type { ParetoRun } from './pareto';
import type { CostPoint, ParetoSolution } from './types';

const MONO = 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace';

export interface RenderParams {
  network: TollNetwork;
  run: ParetoRun | null;
  view: GraphViewport;
  width: number;
  height: number;
  source: number;
  target: number;
  /** 跑完之后的帕累托前沿；搜索中为空 */
  solutions: ParetoSolution[];
  /** 高亮哪一个解，-1 表示没有 */
  selected: number;
  /** 松弛成功后的余晖：边下标 → 剩余帧数 */
  flashes: Map<number, number>;
}

export function renderScene(
  ctx: CanvasRenderingContext2D,
  params: RenderParams
) {
  ctx.fillStyle = paretoColors.background;
  ctx.fillRect(0, 0, params.width, params.height);

  drawRoads(ctx, params);
  drawSolutions(ctx, params);
  drawSearch(ctx, params);
  drawNodes(ctx, params);
}

/**
 * 路网本身。颜色表达的是道路等级：绿色是免费国道，金色是收费快速路。
 * 收费强度拉到 0 时整张图会变绿 —— 第二个目标没有了。
 */
function drawRoads(ctx: CanvasRenderingContext2D, params: RenderParams) {
  const { network, view } = params;
  const fontSize = clamp(Math.round(view.radius * 0.52), 8, 11);

  network.graph.edges.forEach((edge, index) => {
    if (index > edge.reverse) return;

    const road = network.edges[index];
    const geometry = edgeGeometry(network.graph, view, index, 0, 2);
    ctx.strokeStyle = mixColor(
      paretoColors.roadFree,
      paretoColors.roadToll,
      road.grade
    );
    ctx.lineWidth = 1.5 + road.grade * 1.6;
    ctx.beginPath();
    ctx.moveTo(geometry.x1, geometry.y1);
    ctx.lineTo(geometry.x2, geometry.y2);
    ctx.stroke();

    const text =
      road.toll > 0 ? `${road.time}′ ¥${road.toll}` : `${road.time}′`;
    drawPill(ctx, geometry.midX, geometry.midY, text, fontSize);
  });
}

/**
 * 整个前沿一起画：一把从起点散到终点的扇子。
 *
 * 这是这一页和其它三个搜索页最大的不同 —— 那些页面的答案是一条线，
 * 这里的答案是一组线，而且每一条都当得起「最优」这个词。
 */
function drawSolutions(ctx: CanvasRenderingContext2D, params: RenderParams) {
  const { solutions, selected } = params;
  ctx.lineCap = 'round';

  solutions.forEach((solution, index) => {
    if (index === selected) return;
    ctx.globalAlpha = 0.5;
    ctx.strokeStyle = solution.supported
      ? paretoColors.supported
      : paretoColors.unsupported;
    ctx.lineWidth = 3;
    if (!solution.supported) ctx.setLineDash([9, 6]);
    strokePath(ctx, params, solution.path);
    ctx.setLineDash([]);
  });

  ctx.globalAlpha = 1;
  const active = solutions[selected];
  if (active) {
    ctx.strokeStyle = paretoColors.selected;
    ctx.lineWidth = 5;
    if (!active.supported) ctx.setLineDash([10, 6]);
    strokePath(ctx, params, active.path);
    ctx.setLineDash([]);
  }
  ctx.lineCap = 'butt';
}

/** 搜索过程：刚被接受的标签在那条边上留下余晖，正在检查的画成白线 */
function drawSearch(ctx: CanvasRenderingContext2D, params: RenderParams) {
  const { run, flashes } = params;

  ctx.strokeStyle = paretoColors.accepted;
  ctx.lineWidth = 3.5;
  for (const [edge, remaining] of flashes) {
    ctx.globalAlpha = Math.min(1, remaining / FLASH_FRAMES);
    strokeEdge(ctx, params, edge);
  }
  ctx.globalAlpha = 1;

  if (!run || run.activeEdge < 0) return;
  ctx.strokeStyle = run.activeAccepted
    ? paretoColors.accepted
    : paretoColors.active;
  ctx.lineWidth = 4;
  strokeEdge(ctx, params, run.activeEdge);
}

/**
 * 节点圆里写名字，圆下面写此刻留着几个标签。
 *
 * 那个数字就是这一页的成本：单目标 Dijkstra 每个节点永远只写 1，
 * 这里会写到 3、5、8 —— 标签数才是双目标真正的代价所在。
 */
function drawNodes(ctx: CanvasRenderingContext2D, params: RenderParams) {
  const { network, run, view, source, target } = params;
  const graph = network.graph;
  const labelSize = clamp(Math.round(view.radius * 0.75), 10, 15);
  const countSize = clamp(Math.round(view.radius * 0.58), 9, 12);

  for (let node = 0; node < graph.nodes.length; node++) {
    const x = nodeX(graph, view, node);
    const y = nodeY(graph, view, node);
    const count = run?.labelCount(node) ?? 0;

    ctx.fillStyle = nodeFill(params, node, count);
    ctx.beginPath();
    ctx.arc(x, y, view.radius, 0, Math.PI * 2);
    ctx.fill();

    const endpoint = node === source || node === target;
    ctx.strokeStyle = endpoint
      ? node === source
        ? paretoColors.source
        : paretoColors.target
      : paretoColors.nodeStroke;
    ctx.lineWidth = endpoint ? 2.5 : 1.5;
    ctx.stroke();

    ctx.fillStyle = isBrightFill(params, node)
      ? paretoColors.background
      : paretoColors.label;
    ctx.font = `600 ${labelSize}px ${MONO}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(nodeName(node), x, y + 0.5);

    if (!run || count === 0) continue;
    ctx.fillStyle = paretoColors.count;
    ctx.font = `${countSize}px ${MONO}`;
    ctx.textBaseline = 'top';
    ctx.fillText(`×${count}`, x, y + view.radius + 3);
  }
}

function nodeFill(params: RenderParams, node: number, count: number) {
  const { run, source, target } = params;
  if (node === source) return paretoColors.source;
  if (node === target) return paretoColors.target;
  if (run && run.cursor >= 0 && run.nodeOf[run.cursor] === node) {
    return paretoColors.nodeActive;
  }
  if (count === 0) return paretoColors.node;
  return mixColor(
    paretoColors.node,
    paretoColors.nodeLabels,
    Math.min(1, count / 4)
  );
}

function isBrightFill(params: RenderParams, node: number) {
  const { run, source, target } = params;
  if (node === source || node === target) return true;
  return !!run && run.cursor >= 0 && run.nodeOf[run.cursor] === node;
}

function strokePath(
  ctx: CanvasRenderingContext2D,
  params: RenderParams,
  path: number[]
) {
  for (let i = 1; i < path.length; i++) {
    const edge = findEdge(params.network.graph, path[i - 1], path[i]);
    if (edge >= 0) strokeEdge(ctx, params, edge);
  }
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
  ctx.fillStyle = paretoColors.background;
  ctx.fillRect(
    x - boxWidth / 2,
    y - (fontSize + 2.5) / 2,
    boxWidth,
    fontSize + 2.5
  );
  ctx.fillStyle = paretoColors.edgeLabel;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, x, y + 0.5);
}

// ─── 代价空间 ───────────────────────────────────────────────

export interface FrontierParams {
  /** 终点收到过的所有标签，含被淘汰的 */
  samples: CostPoint[];
  solutions: ParetoSolution[];
  /** 用户选中的解 */
  selected: number;
  /** 当前偏好会选中的解 —— 等权重线就画在它身上 */
  best: number;
  lambda: number;
  width: number;
  height: number;
}

/**
 * 代价空间散点图：横轴时间，纵轴过路费，一个点就是一条路。
 *
 * 灰点是搜索途中到过终点、后来被支配掉的路线；亮点是活下来的前沿。
 * 那条金线是当前偏好的等权重线 —— 拖动 λ 它会绕着转，而无论怎么转，
 * 它先碰到的永远是凸包的角点。凹处的紫点就在线的上方几个像素处，
 * 明明更优，却永远轮不到它。
 */
export function renderFrontier(
  ctx: CanvasRenderingContext2D,
  params: FrontierParams
) {
  const { samples, solutions, width, height } = params;
  ctx.fillStyle = paretoColors.background;
  ctx.fillRect(0, 0, width, height);
  if (solutions.length === 0) return;

  const layout = frontierLayout(params);
  const { toX, toY, padLeft, padTop, plotWidth, plotHeight } = layout;

  drawAxes(ctx, {
    padLeft,
    padTop,
    plotWidth,
    plotHeight,
    minTime: layout.minTime,
    maxTime: layout.maxTime,
    maxToll: layout.maxToll,
  });

  // 被支配的历史标签：前沿是这团点的左下边界，看一眼就懂
  ctx.fillStyle = paretoColors.dominated;
  for (const point of samples) {
    ctx.beginPath();
    ctx.arc(toX(point.time), toY(point.toll), 2.5, 0, Math.PI * 2);
    ctx.fill();
  }

  // 角点连成的下凸包 —— 加权和能够到的全部范围
  const corners = solutions.filter(solution => solution.supported);
  if (corners.length > 1) {
    ctx.strokeStyle = paretoColors.supported;
    ctx.globalAlpha = 0.45;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    corners.forEach((corner, index) => {
      const x = toX(corner.time);
      const y = toY(corner.toll);
      if (index === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.stroke();
    ctx.globalAlpha = 1;
  }

  drawIsoLine(ctx, params, layout);

  solutions.forEach((solution, index) => {
    const x = toX(solution.time);
    const y = toY(solution.toll);
    const color = solution.supported
      ? paretoColors.supported
      : paretoColors.unsupported;

    if (index === params.selected) {
      ctx.strokeStyle = paretoColors.selected;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(x, y, 8, 0, Math.PI * 2);
      ctx.stroke();
    }

    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(x, y, 4.5, 0, Math.PI * 2);
    // 空心的是凹处解：它在前沿上，却不在凸包上
    if (solution.supported) {
      ctx.fillStyle = color;
      ctx.fill();
    } else {
      ctx.fillStyle = paretoColors.background;
      ctx.fill();
      ctx.strokeStyle = color;
      ctx.stroke();
    }
  });
}

interface FrontierLayout {
  toX: (time: number) => number;
  toY: (toll: number) => number;
  padLeft: number;
  padTop: number;
  plotWidth: number;
  plotHeight: number;
  minTime: number;
  maxTime: number;
  maxToll: number;
}

/** 代价空间的坐标换算。绘制和点选共用一份，免得两处的点对不上 */
function frontierLayout(params: FrontierParams): FrontierLayout {
  const { samples, solutions, width, height } = params;
  const padLeft = 42;
  const padRight = 14;
  const padTop = 14;
  const padBottom = 20;
  const plotWidth = Math.max(1, width - padLeft - padRight);
  const plotHeight = Math.max(1, height - padTop - padBottom);

  const points = [...samples, ...solutions];
  const minTime = Math.min(...points.map(point => point.time));
  const maxTime = Math.max(...points.map(point => point.time));
  const maxToll = Math.max(...points.map(point => point.toll), 1);
  const spanTime = maxTime - minTime || 1;

  return {
    toX: (time: number) => padLeft + ((time - minTime) / spanTime) * plotWidth,
    toY: (toll: number) => padTop + plotHeight - (toll / maxToll) * plotHeight,
    padLeft,
    padTop,
    plotWidth,
    plotHeight,
    minTime,
    maxTime,
    maxToll,
  };
}

/** 点在哪个解上；没点中返回 -1 */
export function frontierHitTest(
  params: FrontierParams,
  px: number,
  py: number
) {
  if (params.solutions.length === 0) return -1;
  const { toX, toY } = frontierLayout(params);
  let best = -1;
  let bestDist = 13 * 13;
  params.solutions.forEach((solution, index) => {
    const dx = px - toX(solution.time);
    const dy = py - toY(solution.toll);
    const dist = dx * dx + dy * dy;
    if (dist <= bestDist) {
      bestDist = dist;
      best = index;
    }
  });
  return best;
}

function drawAxes(
  ctx: CanvasRenderingContext2D,
  bounds: {
    padLeft: number;
    padTop: number;
    plotWidth: number;
    plotHeight: number;
    minTime: number;
    maxTime: number;
    maxToll: number;
  }
) {
  const { padLeft, padTop, plotWidth, plotHeight } = bounds;
  ctx.strokeStyle = paretoColors.grid;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(padLeft, padTop);
  ctx.lineTo(padLeft, padTop + plotHeight);
  ctx.lineTo(padLeft + plotWidth, padTop + plotHeight);
  ctx.stroke();

  ctx.fillStyle = paretoColors.axis;
  ctx.font = `9px ${MONO}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ctx.fillText(
    `${Math.round(bounds.minTime)} 分`,
    padLeft,
    padTop + plotHeight + 5
  );
  ctx.fillText(
    `${Math.round(bounds.maxTime)} 分`,
    padLeft + plotWidth,
    padTop + plotHeight + 5
  );

  ctx.textAlign = 'right';
  ctx.textBaseline = 'middle';
  ctx.fillText(`¥${Math.round(bounds.maxToll)}`, padLeft - 5, padTop);
  ctx.fillText('¥0', padLeft - 5, padTop + plotHeight);
}

/**
 * 等权重线：`λ·时间 + (1-λ)·过路费 = 常数` 在代价空间里是一条直线，
 * 斜率只由 λ 决定。把它从左下方平推上去，第一个碰到的点就是加权和的答案。
 */
function drawIsoLine(
  ctx: CanvasRenderingContext2D,
  params: FrontierParams,
  layout: FrontierLayout
) {
  const anchor = params.solutions[params.best];
  if (!anchor) return;
  const { toX, toY, padLeft, padTop, plotWidth, plotHeight } = layout;
  const { lambda } = params;

  ctx.strokeStyle = paretoColors.isoLine;
  ctx.globalAlpha = 0.75;
  ctx.lineWidth = 1.5;
  ctx.setLineDash([5, 4]);
  ctx.beginPath();

  if (lambda > 0.999) {
    // 只看时间：等值线竖直
    const x = toX(anchor.time);
    ctx.moveTo(x, padTop);
    ctx.lineTo(x, padTop + plotHeight);
  } else if (lambda < 0.001) {
    const y = toY(anchor.toll);
    ctx.moveTo(padLeft, y);
    ctx.lineTo(padLeft + plotWidth, y);
  } else {
    // toll = anchor.toll - λ/(1-λ) · (time - anchor.time)，两端各延长到画布外
    const slope = -lambda / (1 - lambda);
    const at = (time: number) => anchor.toll + slope * (time - anchor.time);
    const spanX = plotWidth / (toX(anchor.time + 1) - toX(anchor.time) || 1);
    const left = anchor.time - spanX;
    const right = anchor.time + spanX;
    ctx.moveTo(toX(left), toY(at(left)));
    ctx.lineTo(toX(right), toY(at(right)));
  }

  ctx.stroke();
  ctx.setLineDash([]);
  ctx.globalAlpha = 1;
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
