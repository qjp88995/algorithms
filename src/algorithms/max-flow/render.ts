import {
  type EdgeGeometry,
  edgeGeometry,
  type GraphViewport,
  nodeX,
  nodeY,
} from '@/lib/graph/geometry';
import { nodeName } from '@/lib/graph/model';

import { FLASH_FRAMES, flowColors } from './constants';
import type { MaxFlowRun } from './flow';
import type { FlowScene } from './network';

export interface RenderParams {
  scene: FlowScene;
  run: MaxFlowRun | null;
  view: GraphViewport;
  width: number;
  height: number;
  /** 跑完之后画出最小割 */
  showCut: boolean;
  /** 刚推完那条增广路的余晖剩余帧数 */
  flash: number;
  pulse: number;
}

const MONO = 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace';

/** 反向边沿法向让开这么多像素，免得和它的正向边叠在一起 */
const REVERSE_OFFSET = 7;

/**
 * 整张网络画在一层上。
 *
 * 每条边是一根**管子**：粗细正比于容量，里面按 已推/容量 的比例灌上颜色。
 * 满了就变成琥珀色。这样"哪根管子卡住了"不用读数字，扫一眼就知道 ——
 * 而最小割恰好就是那些满管子里的一组。
 */
export function renderScene(
  ctx: CanvasRenderingContext2D,
  params: RenderParams
) {
  ctx.fillStyle = flowColors.background;
  ctx.fillRect(0, 0, params.width, params.height);

  drawPipes(ctx, params);
  drawCut(ctx, params);
  drawFlash(ctx, params);
  drawPath(ctx, params);
  drawActive(ctx, params);
  drawNodes(ctx, params);
}

/** 容量决定管子多粗 —— 宽路窄路一眼分得开 */
function widthOf(params: RenderParams, edge: number) {
  const capacity = params.scene.capacity[edge];
  const largest = maxCapacity(params.scene);
  return 2 + (capacity / largest) * 5;
}

function maxCapacity(scene: FlowScene) {
  let largest = 1;
  for (const capacity of scene.capacity) {
    if (capacity > largest) largest = capacity;
  }
  return largest;
}

function geometryFor(params: RenderParams, edge: number): EdgeGeometry {
  const reverse = params.scene.capacity[edge] === 0;
  return edgeGeometry(
    params.scene.graph,
    params.view,
    edge,
    reverse ? REVERSE_OFFSET : 0,
    9
  );
}

function strokeEdge(
  ctx: CanvasRenderingContext2D,
  params: RenderParams,
  edge: number
) {
  const geometry = geometryFor(params, edge);
  ctx.beginPath();
  ctx.moveTo(geometry.x1, geometry.y1);
  ctx.lineTo(geometry.x2, geometry.y2);
  ctx.stroke();
}

function drawPipes(ctx: CanvasRenderingContext2D, params: RenderParams) {
  const { scene, run, view } = params;
  const fontSize = clamp(Math.round(view.radius * 0.55), 9, 12);

  scene.capacity.forEach((capacity, edge) => {
    // 反向边不是真实的路，只在被增广路用到时才现身
    if (capacity <= 0) return;

    const geometry = geometryFor(params, edge);
    const lineWidth = widthOf(params, edge);
    const pushed = run ? run.flow[edge] : 0;
    const ratio = clamp(pushed / capacity, 0, 1);

    ctx.lineCap = 'round';
    ctx.strokeStyle = flowColors.edge;
    ctx.lineWidth = lineWidth;
    ctx.beginPath();
    ctx.moveTo(geometry.x1, geometry.y1);
    ctx.lineTo(geometry.x2, geometry.y2);
    ctx.stroke();

    if (ratio > 0) {
      // 已经灌进去的那一段，从上游一端起算
      ctx.strokeStyle =
        ratio >= 1 - 1e-9 ? flowColors.saturated : flowColors.flowing;
      ctx.beginPath();
      ctx.moveTo(geometry.x1, geometry.y1);
      ctx.lineTo(
        geometry.x1 + (geometry.x2 - geometry.x1) * ratio,
        geometry.y1 + (geometry.y2 - geometry.y1) * ratio
      );
      ctx.stroke();
    }
    ctx.lineCap = 'butt';

    ctx.fillStyle = ratio >= 1 - 1e-9 ? flowColors.saturated : flowColors.edge;
    arrowHead(ctx, geometry.x2, geometry.y2, geometry.dx, geometry.dy, 7);

    drawLabel(
      ctx,
      geometry.midX,
      geometry.midY,
      `${format(pushed)}/${format(capacity)}`,
      fontSize,
      ratio >= 1 - 1e-9
    );
  });
}

function drawLabel(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  text: string,
  fontSize: number,
  saturated: boolean
) {
  ctx.font = `${fontSize}px ${MONO}`;
  const padding = 2.5;
  const boxWidth = ctx.measureText(text).width + padding * 2;
  const boxHeight = fontSize + padding;

  // 数字压在管子上，底下垫一块背景色，否则和管子搅在一起认不出
  ctx.fillStyle = flowColors.background;
  ctx.fillRect(x - boxWidth / 2, y - boxHeight / 2, boxWidth, boxHeight);
  ctx.fillStyle = saturated ? flowColors.saturated : flowColors.edgeLabel;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, x, y + 0.5);
}

/** 最小割：跑完之后把卡住流的那几条边圈出来 */
function drawCut(ctx: CanvasRenderingContext2D, params: RenderParams) {
  const { run, showCut } = params;
  if (!run || !showCut) return;
  const cut = run.minCut();
  if (!cut) return;

  ctx.strokeStyle = flowColors.cut;
  ctx.setLineDash([]);
  for (const edge of cut.edges) {
    ctx.lineWidth = widthOf(params, edge) + 4;
    ctx.globalAlpha = 0.35;
    strokeEdge(ctx, params, edge);
    ctx.globalAlpha = 1;
  }
}

/** 刚推完的那条增广路 */
function drawFlash(ctx: CanvasRenderingContext2D, params: RenderParams) {
  const { run, flash } = params;
  if (!run || flash <= 0 || run.lastPath.length === 0) return;

  ctx.globalAlpha = Math.min(1, flash / FLASH_FRAMES);
  strokePath(ctx, params, run.lastPath);
  ctx.globalAlpha = 1;
}

/** 正在往下探的那条路 */
function drawPath(ctx: CanvasRenderingContext2D, params: RenderParams) {
  const { run } = params;
  if (!run || run.pathEdges.length === 0) return;
  strokePath(ctx, params, run.pathEdges);
}

/**
 * 画一条增广路。
 *
 * 路上如果有反向边，它单独染成紫色 —— 那一段不是"再推一点"，
 * 而是把之前推过的流**退回去**。这是最大流里最反直觉的一步，
 * 值得在画面上有自己的颜色。
 */
function strokePath(
  ctx: CanvasRenderingContext2D,
  params: RenderParams,
  path: number[]
) {
  const { run } = params;
  if (!run) return;

  for (const edge of path) {
    const reverse = run.isReverse(edge);
    ctx.strokeStyle = reverse ? flowColors.reverse : flowColors.path;
    ctx.lineWidth = reverse ? 3 : widthOf(params, edge) + 1.5;
    ctx.lineCap = 'round';
    strokeEdge(ctx, params, edge);
    ctx.lineCap = 'butt';

    if (!reverse) continue;
    // 退货方向和管子的方向相反，箭头得单独画出来
    const geometry = geometryFor(params, edge);
    ctx.fillStyle = flowColors.reverse;
    arrowHead(ctx, geometry.x2, geometry.y2, geometry.dx, geometry.dy, 6);
  }
}

function drawActive(ctx: CanvasRenderingContext2D, params: RenderParams) {
  const { run } = params;
  if (!run || run.activeEdge < 0) return;

  ctx.strokeStyle = flowColors.active;
  ctx.lineWidth = 2;
  ctx.setLineDash([4, 3]);
  strokeEdge(ctx, params, run.activeEdge);
  ctx.setLineDash([]);
}

function drawNodes(ctx: CanvasRenderingContext2D, params: RenderParams) {
  const { scene, run, view, showCut, pulse } = params;
  const graph = scene.graph;
  const labelSize = clamp(Math.round(view.radius * 0.75), 10, 15);
  const levelSize = clamp(Math.round(view.radius * 0.55), 9, 12);
  const cut = showCut ? run?.minCut() : null;
  const side = cut ? run!.side() : null;

  const active =
    run && run.activeEdge >= 0
      ? [graph.edges[run.activeEdge].from, graph.edges[run.activeEdge].to]
      : [];

  for (let node = 0; node < graph.nodes.length; node++) {
    const x = nodeX(graph, view, node);
    const y = nodeY(graph, view, node);

    ctx.fillStyle = nodeFill(params, node, side, active);
    ctx.beginPath();
    ctx.arc(x, y, view.radius, 0, Math.PI * 2);
    ctx.fill();

    if (node === scene.source || node === scene.sink) {
      // 源汇呼吸一圈，一眼找得到流从哪来往哪去
      ctx.strokeStyle =
        node === scene.source ? flowColors.source : flowColors.sink;
      ctx.globalAlpha = 0.5 + 0.5 * Math.sin(pulse * 0.08);
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.arc(x, y, view.radius + 4, 0, Math.PI * 2);
      ctx.stroke();
      ctx.globalAlpha = 1;
    }

    ctx.strokeStyle = flowColors.nodeStroke;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(x, y, view.radius, 0, Math.PI * 2);
    ctx.stroke();

    const bright =
      node === scene.source || node === scene.sink || active.includes(node);
    ctx.fillStyle = bright ? flowColors.background : flowColors.label;
    ctx.font = `600 ${labelSize}px ${MONO}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(nodeName(node), x, y + 0.5);

    // Dinic 的层次：这一相位里，这个点离源点几条边
    if (!run || run.level[node] < 0) continue;
    ctx.fillStyle = flowColors.level;
    ctx.font = `${levelSize}px ${MONO}`;
    ctx.textBaseline = 'top';
    ctx.fillText(`L${run.level[node]}`, x, y + view.radius + 3);
  }
}

function nodeFill(
  params: RenderParams,
  node: number,
  side: Uint8Array | null,
  active: number[]
) {
  const { scene } = params;
  if (node === scene.source) return flowColors.source;
  if (node === scene.sink) return flowColors.sink;
  if (active.includes(node)) return flowColors.nodeActive;
  if (side) return side[node] ? flowColors.sideSource : flowColors.sideSink;
  return flowColors.node;
}

export function format(value: number) {
  if (!Number.isFinite(value)) return '∞';
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

function arrowHead(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  dx: number,
  dy: number,
  size: number
) {
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(
    x - dx * size + dy * size * 0.45,
    y - dy * size - dx * size * 0.45
  );
  ctx.lineTo(
    x - dx * size - dy * size * 0.45,
    y - dy * size + dx * size * 0.45
  );
  ctx.closePath();
  ctx.fill();
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}
