import { seededRandom } from '@/lib/random';

import { buildGraph, type GraphModel, type GraphNode } from './model';

export interface GraphSpec {
  nodeCount: number;
  /** 目标平均度数；无向连线数约等于 nodeCount × degree ÷ 2 */
  degree: number;
  seed: number;
}

/**
 * 长一张「看得懂」的平面图。
 *
 * 随手连的随机图在画布上就是一团毛线：边互相穿过，用户根本读不出
 * 哪条路更短。所以这里刻意做成**近似平面图**：
 *
 *   1. 泊松盘采样撒点 —— 节点不会挤成一堆，标签和权重才有地方写；
 *   2. 先铺一棵欧氏最小生成树 —— 保证连通，而且欧氏 MST 天然不自交；
 *   3. 再按长度从短到晚补边，凡是与已有边交叉的一律跳过。
 *
 * 结果既连通又不打结，"这条明显绕远"这种判断可以直接用眼睛做 ——
 * 而这正是最短路演示要让人对照算法结果的东西。
 */
export function generateGeometricGraph(spec: GraphSpec): GraphModel {
  const random = seededRandom(spec.seed);
  const nodes = scatterNodes(spec.nodeCount, random);
  const links = connectNodes(nodes, spec.degree);
  return buildGraph(nodes, links);
}

/** 泊松盘采样：拒绝离已有点太近的候选，采不够就放宽间距 */
function scatterNodes(count: number, random: () => number): GraphNode[] {
  const nodes: GraphNode[] = [];
  let minDist = 0.72 / Math.sqrt(count);
  let misses = 0;

  while (nodes.length < count) {
    const candidate = { x: random(), y: random() };
    const tooClose = nodes.some(
      node => Math.hypot(node.x - candidate.x, node.y - candidate.y) < minDist
    );
    if (tooClose) {
      // 连着撞了很多次说明间距要求过高，退一步，否则会死循环
      if (++misses > 40) {
        minDist *= 0.88;
        misses = 0;
      }
      continue;
    }
    nodes.push(candidate);
    misses = 0;
  }

  return normalize(nodes);
}

/** 把点云拉伸到充满 [0, 1]²，免得画布四周留出大片空白 */
function normalize(nodes: GraphNode[]): GraphNode[] {
  const xs = nodes.map(node => node.x);
  const ys = nodes.map(node => node.y);
  const minX = Math.min(...xs);
  const minY = Math.min(...ys);
  const spanX = Math.max(...xs) - minX || 1;
  const spanY = Math.max(...ys) - minY || 1;
  return nodes.map(node => ({
    x: (node.x - minX) / spanX,
    y: (node.y - minY) / spanY,
  }));
}

function connectNodes(nodes: GraphNode[], degree: number): [number, number][] {
  const count = nodes.length;
  const links: [number, number][] = spanningTree(nodes);
  const taken = new Set(links.map(key));

  // 目标连线数：平均度数 × 节点数 ÷ 2，但至少得有生成树那么多
  const target = Math.max(links.length, Math.round((count * degree) / 2));

  const candidates: [number, number][] = [];
  for (let a = 0; a < count; a++) {
    for (let b = a + 1; b < count; b++) {
      if (taken.has(key([a, b]))) continue;
      candidates.push([a, b]);
    }
  }
  candidates.sort((p, q) => span(nodes, p) - span(nodes, q));

  for (const candidate of candidates) {
    if (links.length >= target) break;
    if (links.some(link => crosses(nodes, link, candidate))) continue;
    links.push(candidate);
    taken.add(key(candidate));
  }

  return links;
}

/** Prim 跑在完全欧氏图上：节点少，O(n²) 足够 */
function spanningTree(nodes: GraphNode[]): [number, number][] {
  const count = nodes.length;
  const links: [number, number][] = [];
  if (count < 2) return links;

  const inTree = new Uint8Array(count);
  const best = new Float64Array(count).fill(Infinity);
  const from = new Int32Array(count).fill(-1);
  inTree[0] = 1;
  for (let v = 1; v < count; v++) {
    best[v] = span(nodes, [0, v]);
    from[v] = 0;
  }

  for (let added = 1; added < count; added++) {
    let pick = -1;
    for (let v = 0; v < count; v++) {
      if (inTree[v]) continue;
      if (pick < 0 || best[v] < best[pick]) pick = v;
    }
    inTree[pick] = 1;
    links.push([Math.min(from[pick], pick), Math.max(from[pick], pick)]);
    for (let v = 0; v < count; v++) {
      if (inTree[v]) continue;
      const dist = span(nodes, [pick, v]);
      if (dist < best[v]) {
        best[v] = dist;
        from[v] = pick;
      }
    }
  }

  return links;
}

function span(nodes: GraphNode[], link: [number, number]) {
  return Math.hypot(
    nodes[link[0]].x - nodes[link[1]].x,
    nodes[link[0]].y - nodes[link[1]].y
  );
}

function key(link: [number, number]) {
  return link[0] < link[1] ? `${link[0]}-${link[1]}` : `${link[1]}-${link[0]}`;
}

/**
 * 两条线段是否真正相交。共用端点不算交叉 —— 从同一个节点扇出去的边
 * 本来就在那一点碰头。
 */
function crosses(nodes: GraphNode[], a: [number, number], b: [number, number]) {
  if (a[0] === b[0] || a[0] === b[1] || a[1] === b[0] || a[1] === b[1]) {
    return false;
  }
  const p1 = nodes[a[0]];
  const p2 = nodes[a[1]];
  const p3 = nodes[b[0]];
  const p4 = nodes[b[1]];
  const d1 = cross(p3, p4, p1);
  const d2 = cross(p3, p4, p2);
  const d3 = cross(p1, p2, p3);
  const d4 = cross(p1, p2, p4);
  return d1 * d2 < 0 && d3 * d4 < 0;
}

function cross(a: GraphNode, b: GraphNode, p: GraphNode) {
  return (b.x - a.x) * (p.y - a.y) - (b.y - a.y) * (p.x - a.x);
}
