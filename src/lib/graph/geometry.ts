import type { GraphModel } from './model';

/** 归一化坐标 → 画布像素的换算参数，外加节点圆的半径 */
export interface GraphViewport {
  scaleX: number;
  scaleY: number;
  offsetX: number;
  offsetY: number;
  radius: number;
}

export function computeGraphViewport(
  graph: GraphModel,
  width: number,
  height: number
): GraphViewport {
  const radius = clamp(
    Math.min(width, height) /
      (2.6 * Math.sqrt(Math.max(graph.nodes.length, 1))),
    11,
    21
  );
  // 留出的边距要能装下圆本身，再加上圆下方那行距离值
  const padX = radius + 20;
  const padY = radius + 26;
  return {
    scaleX: Math.max(1, width - padX * 2),
    scaleY: Math.max(1, height - padY * 2),
    offsetX: padX,
    offsetY: padY,
    radius,
  };
}

export function nodeX(graph: GraphModel, view: GraphViewport, node: number) {
  return view.offsetX + graph.nodes[node].x * view.scaleX;
}

export function nodeY(graph: GraphModel, view: GraphViewport, node: number) {
  return view.offsetY + graph.nodes[node].y * view.scaleY;
}

/** 命中测试：像素坐标落在哪个节点上，没有返回 -1 */
export function nodeAt(
  graph: GraphModel,
  view: GraphViewport,
  px: number,
  py: number
) {
  const reach = view.radius + 5;
  for (let node = 0; node < graph.nodes.length; node++) {
    const dx = px - nodeX(graph, view, node);
    const dy = py - nodeY(graph, view, node);
    if (dx * dx + dy * dy <= reach * reach) return node;
  }
  return -1;
}

/** 一条有向边画在哪：已经避开两端的圆，并沿法向让开反向边 */
export interface EdgeGeometry {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  /** 线段中点，权重标签写在这儿 */
  midX: number;
  midY: number;
  /** 行进方向的单位向量，画箭头用 */
  dx: number;
  dy: number;
}

/**
 * 有向边的几何。
 *
 * `offset` 是沿行进方向左侧的横向位移：一对方向相反的边如果画在同一条
 * 直线上，两个箭头会叠在一起，两个权重也会打架 —— 各让开几个像素，
 * 「A→B 便宜、B→A 贵」才看得出来是两件事。
 */
export function edgeGeometry(
  graph: GraphModel,
  view: GraphViewport,
  edge: number,
  offset: number,
  /** 终点侧额外留出的空隙，给箭头站的地方；不画箭头时收到最小 */
  headGap = 9
): EdgeGeometry {
  const { from, to } = graph.edges[edge];
  const ax = nodeX(graph, view, from);
  const ay = nodeY(graph, view, from);
  const bx = nodeX(graph, view, to);
  const by = nodeY(graph, view, to);

  const length = Math.hypot(bx - ax, by - ay) || 1;
  const dx = (bx - ax) / length;
  const dy = (by - ay) / length;
  // 左法向：把线段整体平移出去，避开反向边
  const ox = dy * offset;
  const oy = -dx * offset;

  const startGap = view.radius + 2;
  const endGap = view.radius + headGap;
  const x1 = ax + dx * startGap + ox;
  const y1 = ay + dy * startGap + oy;
  const x2 = ax + dx * Math.max(startGap, length - endGap) + ox;
  const y2 = ay + dy * Math.max(startGap, length - endGap) + oy;

  return { x1, y1, x2, y2, midX: (x1 + x2) / 2, midY: (y1 + y2) / 2, dx, dy };
}

/** 沿路径按比例取点，用于让小车/光点在折线上平滑行走 */
export function pointAlongPath(
  graph: GraphModel,
  view: GraphViewport,
  path: number[],
  progress: number
) {
  if (path.length === 0) return null;
  const clamped = clamp(progress, 0, path.length - 1);
  const index = Math.min(Math.floor(clamped), path.length - 2);
  if (index < 0) {
    return { x: nodeX(graph, view, path[0]), y: nodeY(graph, view, path[0]) };
  }
  const t = clamped - index;
  const ax = nodeX(graph, view, path[index]);
  const ay = nodeY(graph, view, path[index]);
  const bx = nodeX(graph, view, path[index + 1]);
  const by = nodeY(graph, view, path[index + 1]);
  return { x: ax + (bx - ax) * t, y: ay + (by - ay) * t };
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}
