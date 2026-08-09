import {
  edgeGeometry,
  type GraphViewport,
  nodeX,
  nodeY,
} from '@/lib/graph/geometry';
import { nodeName } from '@/lib/graph/model';

import { componentColors, FLASH_FRAMES, graphColors } from './constants';
import type { TreeComparison } from './reference';
import type { SpanningScene } from './scene';
import type { SpanningTreeRun } from './spanning';

export interface RenderParams {
  scene: SpanningScene;
  run: SpanningTreeRun | null;
  /** 打开对照时才有：最短路树以及它和生成树的差距 */
  comparison: TreeComparison | null;
  view: GraphViewport;
  width: number;
  height: number;
  root: number;
  /** 收下一条边之后的余晖：边下标 → 剩余帧数 */
  flashes: Map<number, number>;
  /** 绕远最厉害那个点的呼吸相位 */
  pulse: number;
}

const MONO = 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace';

/**
 * 整张图画在一层上。节点最多二十来个、边不过百，一帧全画完的开销
 * 远低于维护离屏层的复杂度。
 *
 * 分层顺序就是信息的优先级：底下是还没碰过的边，往上依次是被丢掉的、
 * 对照用的最短路树、已经收进树里的边，最上面是这一拍正在看的那条。
 */
export function renderScene(
  ctx: CanvasRenderingContext2D,
  params: RenderParams
) {
  ctx.fillStyle = graphColors.background;
  ctx.fillRect(0, 0, params.width, params.height);

  drawEdges(ctx, params);
  drawShortestTree(ctx, params);
  drawTree(ctx, params);
  drawCandidates(ctx, params);
  drawActive(ctx, params);
  drawNodes(ctx, params);
}

/** 生成树是无向的：一条连线只画一次，不画箭头 */
function geometryFor(params: RenderParams, link: number) {
  return edgeGeometry(params.scene.graph, params.view, link, 0, 2);
}

function strokeLink(
  ctx: CanvasRenderingContext2D,
  params: RenderParams,
  link: number
) {
  const geometry = geometryFor(params, link);
  ctx.beginPath();
  ctx.moveTo(geometry.x1, geometry.y1);
  ctx.lineTo(geometry.x2, geometry.y2);
  ctx.stroke();
}

function drawEdges(ctx: CanvasRenderingContext2D, params: RenderParams) {
  const { scene, run, view } = params;
  const fontSize = clamp(Math.round(view.radius * 0.58), 9, 12);

  for (const link of scene.links) {
    const discarded = run?.discarded[link] === 1 && run.inTree[link] === 0;
    ctx.strokeStyle = discarded ? graphColors.rejected : graphColors.edge;
    ctx.lineWidth = 1.5;
    strokeLink(ctx, params, link);

    const geometry = geometryFor(params, link);
    drawWeight(
      ctx,
      geometry.midX,
      geometry.midY,
      scene.weights[link],
      fontSize,
      discarded
    );
  }
}

function drawWeight(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  weight: number,
  fontSize: number,
  dimmed: boolean
) {
  const text = String(weight);
  ctx.font = `${fontSize}px ${MONO}`;
  const padding = 2.5;
  const boxWidth = ctx.measureText(text).width + padding * 2;
  const boxHeight = fontSize + padding;

  // 权重压在线上，底下垫一块背景色，否则数字和线搅在一起认不出
  ctx.fillStyle = graphColors.background;
  ctx.fillRect(x - boxWidth / 2, y - boxHeight / 2, boxWidth, boxHeight);
  ctx.fillStyle = dimmed ? graphColors.rejected : graphColors.edgeLabel;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, x, y + 0.5);
}

/**
 * 对照用的最短路树。
 *
 * 画成虚线是因为它不是这一页在算的东西 —— 它是"另一种最优"，
 * 摆在这儿就为了让人看见两棵树的边集根本不重合。
 */
function drawShortestTree(ctx: CanvasRenderingContext2D, params: RenderParams) {
  const { comparison } = params;
  if (!comparison) return;

  ctx.strokeStyle = graphColors.shortestTree;
  ctx.lineWidth = 5;
  ctx.setLineDash([7, 5]);
  for (const link of comparison.links) strokeLink(ctx, params, link);
  ctx.setLineDash([]);
}

function drawTree(ctx: CanvasRenderingContext2D, params: RenderParams) {
  const { run, scene, flashes } = params;
  if (!run) return;

  ctx.strokeStyle = graphColors.tree;
  ctx.lineWidth = 3;
  ctx.lineCap = 'round';
  for (const link of scene.links) {
    if (run.inTree[link]) strokeLink(ctx, params, link);
  }

  // 刚收下的那几条再叠一层白光，速度拉高时才看得清树是怎么长的
  ctx.strokeStyle = graphColors.active;
  ctx.lineWidth = 4;
  for (const [link, remaining] of flashes) {
    ctx.globalAlpha = Math.min(1, remaining / FLASH_FRAMES) * 0.7;
    strokeLink(ctx, params, link);
  }
  ctx.globalAlpha = 1;
  ctx.lineCap = 'butt';
}

/** Borůvka 本轮各分量选中的最便宜出边 */
function drawCandidates(ctx: CanvasRenderingContext2D, params: RenderParams) {
  const { run, scene } = params;
  if (!run) return;

  const picked = new Set<number>();
  for (let node = 0; node < scene.graph.nodes.length; node++) {
    const link = run.cheapest[node];
    if (link >= 0 && !run.inTree[link]) picked.add(link);
  }
  if (picked.size === 0) return;

  ctx.strokeStyle = graphColors.candidate;
  ctx.lineWidth = 2.5;
  for (const link of picked) strokeLink(ctx, params, link);
}

function drawActive(ctx: CanvasRenderingContext2D, params: RenderParams) {
  const { run } = params;
  if (!run || run.activeEdge < 0) return;

  // 红＝这一拍被丢掉，青＝Borůvka 把它记成了某个分量的最优出边
  ctx.strokeStyle = run.activeRejected
    ? graphColors.detour
    : run.activeCandidate
      ? graphColors.candidate
      : graphColors.active;
  ctx.lineWidth = 4;
  strokeLink(ctx, params, run.activeEdge);
}

/**
 * 分量配色：只给成员两个起步的分量上色。
 *
 * 一上来每个点各自成块，全都上色就是一屏花斑，反而看不出谁跟谁并了。
 * 颜色按分量里最小的那个节点下标取 —— 两块并起来时，编号小的那块
 * 保住自己的颜色，另一块跟着变，合并这件事就有了方向感。
 */
function componentTints(params: RenderParams) {
  const tints = new Map<number, string>();
  const { run, scene } = params;
  if (!run) return tints;

  const size = new Map<number, number>();
  const smallest = new Map<number, number>();
  for (let node = 0; node < scene.graph.nodes.length; node++) {
    const component = run.componentOf(node);
    size.set(component, (size.get(component) ?? 0) + 1);
    if (!smallest.has(component)) smallest.set(component, node);
  }
  for (const [component, count] of size) {
    if (count < 2) continue;
    const index = smallest.get(component)! % componentColors.length;
    tints.set(component, componentColors[index]);
  }
  return tints;
}

function drawNodes(ctx: CanvasRenderingContext2D, params: RenderParams) {
  const { scene, run, comparison, view, root, pulse } = params;
  const graph = scene.graph;
  const labelSize = clamp(Math.round(view.radius * 0.75), 10, 15);
  const distSize = clamp(Math.round(view.radius * 0.58), 9, 12);
  const tints = componentTints(params);

  for (let node = 0; node < graph.nodes.length; node++) {
    const x = nodeX(graph, view, node);
    const y = nodeY(graph, view, node);
    const tint = run ? tints.get(run.componentOf(node)) : undefined;
    const active =
      run !== null &&
      run.activeEdge >= 0 &&
      (graph.edges[run.activeEdge].from === node ||
        graph.edges[run.activeEdge].to === node);

    const fill =
      node === root
        ? graphColors.root
        : active
          ? graphColors.nodeActive
          : (tint ?? graphColors.node);

    ctx.fillStyle = fill;
    ctx.beginPath();
    ctx.arc(x, y, view.radius, 0, Math.PI * 2);
    ctx.fill();

    const worst =
      comparison && comparison.worstRatio > 1 && comparison.worstNode === node;
    if (worst) {
      // 绕远最厉害的那个点：呼吸一圈红，说明就在讲它
      ctx.strokeStyle = graphColors.detour;
      ctx.globalAlpha = 0.55 + 0.45 * Math.sin(pulse * 0.12);
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(x, y, view.radius + 4, 0, Math.PI * 2);
      ctx.stroke();
      ctx.globalAlpha = 1;
    }

    ctx.strokeStyle = node === root ? graphColors.root : graphColors.nodeStroke;
    ctx.lineWidth = node === root ? 2.5 : 1.5;
    ctx.beginPath();
    ctx.arc(x, y, view.radius, 0, Math.PI * 2);
    ctx.stroke();

    // 浅色底上写深色字，否则名字在分量色块上看不清
    const bright = node === root || active || tint !== undefined;
    ctx.fillStyle = bright ? graphColors.background : graphColors.label;
    ctx.font = `600 ${labelSize}px ${MONO}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(nodeName(node), x, y + 0.5);

    if (!comparison) continue;
    // 圆下面那行是「沿生成树走 / 真正的最短」，两者不等就是绕了远路
    const via = comparison.viaTree[node];
    const best = comparison.shortest[node];
    ctx.fillStyle =
      Number.isFinite(via) && via > best + 1e-9
        ? graphColors.detour
        : graphColors.dist;
    ctx.font = `${distSize}px ${MONO}`;
    ctx.textBaseline = 'top';
    ctx.fillText(
      `${formatDistance(via)}/${formatDistance(best)}`,
      x,
      y + view.radius + 3
    );
  }
}

export function formatDistance(value: number) {
  if (!Number.isFinite(value)) return '∞';
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}
