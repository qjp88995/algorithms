import {
  type EdgeGeometry,
  edgeGeometry,
  type GraphViewport,
  nodeX,
  nodeY,
} from '@/lib/graph/geometry';
import { findEdge, nodeName } from '@/lib/graph/model';

import { FLASH_FRAMES, graphColors } from './constants';
import type { ShortestScene } from './scene';
import type { ShortestPathRun } from './shortest';

export interface RenderParams {
  scene: ShortestScene;
  run: ShortestPathRun | null;
  view: GraphViewport;
  width: number;
  height: number;
  source: number;
  target: number;
  /** 松弛成功后的余晖：边下标 → 剩余帧数 */
  flashes: Map<number, number>;
  path: number[];
  /** 路径已揭示到第几段（浮点，做逐段亮起的动画） */
  revealed: number;
  /** 负环呼吸灯的相位 */
  pulse: number;
}

const MONO = 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace';

/**
 * 整张图画在一层上。
 *
 * 节点最多二十来个、边不过百，一帧全画完的开销远低于维护离屏层的复杂度 ——
 * 网格寻路那套「静态层 + 覆盖层」在这个规模上是过度设计。
 */
export function renderScene(
  ctx: CanvasRenderingContext2D,
  params: RenderParams
) {
  ctx.fillStyle = graphColors.background;
  ctx.fillRect(0, 0, params.width, params.height);

  drawEdges(ctx, params);
  drawTree(ctx, params);
  drawPath(ctx, params);
  drawDetour(ctx, params);
  drawActive(ctx, params);
  drawNegativeCycle(ctx, params);
  drawNodes(ctx, params);
}

/**
 * 一条有向边画在哪。
 *
 * 正反同权时（默认情况）两条边合并成一条不带箭头的线 —— 代价两个方向
 * 一样，方向本来就不是信息，画两遍只会挤掉权重标签的位置。一旦某个方向
 * 被翻成负权，两条线就分开各画各的箭头，视觉上的"不对称"正好对应
 * 代价上的不对称。
 */
function geometryFor(params: RenderParams, edge: number): EdgeGeometry {
  const symmetric = isSymmetric(params.scene, edge);
  return edgeGeometry(
    params.scene.graph,
    params.view,
    edge,
    symmetric ? 0 : 4,
    symmetric ? 2 : 9
  );
}

function isSymmetric(scene: ShortestScene, edge: number) {
  return scene.weights[edge] === scene.weights[scene.graph.edges[edge].reverse];
}

function drawEdges(ctx: CanvasRenderingContext2D, params: RenderParams) {
  const { scene, view } = params;
  const { graph, weights } = scene;
  const fontSize = clamp(Math.round(view.radius * 0.58), 9, 12);

  graph.edges.forEach((edge, index) => {
    const symmetric = isSymmetric(scene, index);
    if (symmetric && index > edge.reverse) return;

    const geometry = geometryFor(params, index);
    const negative = weights[index] < 0;

    ctx.strokeStyle = negative ? graphColors.edgeNegative : graphColors.edge;
    ctx.lineWidth = negative ? 2 : 1.5;
    ctx.beginPath();
    ctx.moveTo(geometry.x1, geometry.y1);
    ctx.lineTo(geometry.x2, geometry.y2);
    ctx.stroke();

    if (!symmetric) {
      ctx.fillStyle = ctx.strokeStyle;
      arrowHead(ctx, geometry.x2, geometry.y2, geometry.dx, geometry.dy, 6);
    }

    drawWeight(
      ctx,
      geometry.midX,
      geometry.midY,
      weights[index],
      fontSize,
      negative
    );
  });
}

function drawWeight(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  weight: number,
  fontSize: number,
  negative: boolean
) {
  const text = String(weight);
  ctx.font = `${fontSize}px ${MONO}`;
  const padding = 2.5;
  const boxWidth = ctx.measureText(text).width + padding * 2;
  const boxHeight = fontSize + padding;

  // 权重压在线上，底下垫一块背景色，否则数字和线搅在一起认不出
  ctx.fillStyle = graphColors.background;
  ctx.fillRect(x - boxWidth / 2, y - boxHeight / 2, boxWidth, boxHeight);
  ctx.fillStyle = negative ? graphColors.edgeNegative : graphColors.edgeLabel;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, x, y + 0.5);
}

/** 最短路树：每个节点的父指针连起来，就是"目前认为最好的走法" */
function drawTree(ctx: CanvasRenderingContext2D, params: RenderParams) {
  const { run, scene } = params;
  if (!run) return;

  ctx.strokeStyle = graphColors.tree;
  ctx.lineWidth = 2.5;
  for (let node = 0; node < scene.graph.nodes.length; node++) {
    const parent = run.parent[node];
    if (parent < 0 || node === parent) continue;
    const edge = findEdge(scene.graph, parent, node);
    if (edge >= 0) strokeEdge(ctx, params, edge);
  }
}

function drawPath(ctx: CanvasRenderingContext2D, params: RenderParams) {
  const { path, revealed } = params;
  if (path.length < 2) return;

  ctx.strokeStyle = graphColors.path;
  ctx.lineWidth = 4;
  ctx.lineCap = 'round';
  const segments = Math.min(path.length - 1, Math.floor(revealed));
  for (let i = 0; i < segments; i++) {
    const edge = findEdge(params.scene.graph, path[i], path[i + 1]);
    if (edge >= 0) strokeEdge(ctx, params, edge);
  }
  ctx.lineCap = 'butt';
}

/** Floyd 正在试的绕行 i ⇝ k ⇝ j。虚线，因为这两段未必是直接相连的边 */
function drawDetour(ctx: CanvasRenderingContext2D, params: RenderParams) {
  const { run, scene, view } = params;
  if (!run || run.pivot < 0 || run.cursor < 0 || run.column < 0) return;
  if (run.cursor === run.pivot || run.column === run.pivot) return;

  ctx.strokeStyle = graphColors.detour;
  ctx.lineWidth = 2;
  ctx.setLineDash([5, 4]);
  ctx.beginPath();
  for (const node of [run.cursor, run.pivot, run.column]) {
    ctx.lineTo(nodeX(scene.graph, view, node), nodeY(scene.graph, view, node));
  }
  ctx.stroke();
  ctx.setLineDash([]);
}

/** 正在检查的那条边，外加刚刚松弛成功的余晖 */
function drawActive(ctx: CanvasRenderingContext2D, params: RenderParams) {
  const { run, flashes } = params;

  ctx.strokeStyle = graphColors.improved;
  ctx.lineWidth = 3.5;
  for (const [edge, remaining] of flashes) {
    ctx.globalAlpha = Math.min(1, remaining / FLASH_FRAMES);
    strokeEdge(ctx, params, edge);
  }
  ctx.globalAlpha = 1;

  if (!run || run.activeEdge < 0) return;
  ctx.strokeStyle = run.activeImproved
    ? graphColors.improved
    : graphColors.active;
  ctx.lineWidth = 4;
  strokeEdge(ctx, params, run.activeEdge);
}

function drawNegativeCycle(
  ctx: CanvasRenderingContext2D,
  params: RenderParams
) {
  const { run, scene, view, pulse } = params;
  const cycle = run?.negativeCycleNodes.length
    ? run.negativeCycleNodes
    : sceneCycleNodes(scene);
  if (cycle.length === 0) return;

  ctx.strokeStyle = graphColors.cycle;
  ctx.globalAlpha = 0.55 + 0.45 * Math.sin(pulse * 0.12);
  ctx.lineWidth = 3.5;
  for (let i = 0; i < cycle.length; i++) {
    const edge = findEdge(scene.graph, cycle[i], cycle[(i + 1) % cycle.length]);
    if (edge >= 0) strokeEdge(ctx, params, edge);
  }
  // 环上的点也套一圈红：环退化成单个点时至少还看得见它在哪
  for (const node of cycle) {
    ctx.beginPath();
    ctx.arc(
      nodeX(scene.graph, view, node),
      nodeY(scene.graph, view, node),
      view.radius + 4,
      0,
      Math.PI * 2
    );
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
}

/** 场景里预埋的负环 —— 算法还没跑到时也该看得见它 */
function sceneCycleNodes(scene: ShortestScene) {
  return scene.cycleEdges.map(edge => scene.graph.edges[edge].from);
}

function drawNodes(ctx: CanvasRenderingContext2D, params: RenderParams) {
  const { scene, run, view, source, target } = params;
  const graph = scene.graph;
  const labelSize = clamp(Math.round(view.radius * 0.75), 10, 15);
  const distSize = clamp(Math.round(view.radius * 0.58), 9, 12);

  for (let node = 0; node < graph.nodes.length; node++) {
    const x = nodeX(graph, view, node);
    const y = nodeY(graph, view, node);

    ctx.fillStyle = nodeFill(params, node);
    ctx.beginPath();
    ctx.arc(x, y, view.radius, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = ringColor(params, node);
    ctx.lineWidth = node === source || node === target ? 2.5 : 1.5;
    ctx.stroke();

    ctx.fillStyle = isBrightFill(params, node)
      ? graphColors.background
      : graphColors.label;
    ctx.font = `600 ${labelSize}px ${MONO}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(nodeName(node), x, y + 0.5);

    if (!run) continue;
    ctx.fillStyle = run.isWrong(node) ? graphColors.wrong : graphColors.dist;
    ctx.font = `${distSize}px ${MONO}`;
    ctx.textBaseline = 'top';
    ctx.fillText(formatDistance(run.dist[node]), x, y + view.radius + 3);
  }
}

function nodeFill(params: RenderParams, node: number) {
  const { run, source, target } = params;
  if (node === source) return graphColors.source;
  if (node === target) return graphColors.target;
  if (run?.cursor === node) return graphColors.nodeActive;
  if (run?.pivot === node) return graphColors.nodePivot;
  if (run?.settled[node]) return graphColors.nodeSettled;
  if (run && Number.isFinite(run.dist[node])) return graphColors.nodeReached;
  return graphColors.node;
}

/** 浅色底上写深色字，否则节点名在起点/终点/游标上看不清 */
function isBrightFill(params: RenderParams, node: number) {
  const { run, source, target } = params;
  return (
    node === source ||
    node === target ||
    run?.cursor === node ||
    run?.pivot === node
  );
}

function ringColor(params: RenderParams, node: number) {
  const { run, source, target } = params;
  if (node === source) return graphColors.source;
  if (node === target) return graphColors.target;
  if (run?.isWrong(node)) return graphColors.wrong;
  return graphColors.nodeStroke;
}

export function formatDistance(value: number) {
  if (!Number.isFinite(value)) return '∞';
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
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
