import { generateGeometricGraph } from '@/lib/graph/generate';
import { farthestPair, type GraphModel } from '@/lib/graph/model';
import { seededRandom } from '@/lib/random';

import { MAX_WEIGHT, MIN_WEIGHT } from './constants';
import { hasNegativeCycle } from './reference';
import type { ShortestConfig } from './types';

/** 一张图 + 一套边权 + 一对端点，构成演示的一「局」 */
export interface ShortestScene {
  graph: GraphModel;
  /** 按边下标存的权重，可正可负 */
  weights: Float64Array;
  /** 被翻成负权的边下标 */
  negativeEdges: number[];
  /** 故意注入的那个负环所占的边，画布上要单独圈出来 */
  cycleEdges: number[];
  /** 生成时挑的默认端点：图上离得最远的一对 */
  source: number;
  target: number;
}

export function buildScene(config: ShortestConfig): ShortestScene {
  const graph = generateGeometricGraph({
    nodeCount: config.nodeCount,
    degree: config.degree,
    seed: config.seed,
  });

  const weights = baseWeights(graph);
  const negativeEdges = applyNegatives(graph, weights, config);
  const cycleEdges = config.negativeCycle ? injectCycle(graph, weights) : [];
  const { source, target } = farthestPair(graph);

  return { graph, weights, negativeEdges, cycleEdges, source, target };
}

/**
 * 默认权重正比于图上的长度，并取整到 1…9。
 *
 * 这不是为了好看：权重和画面上的线长对得上，用户才能靠眼睛先猜一个
 * 答案，再去看算法给的是不是同一条。整数则是为了能心算验算。
 */
function baseWeights(graph: GraphModel): Float64Array {
  const weights = new Float64Array(graph.edges.length);
  graph.edges.forEach((edge, index) => {
    // 只算一次，反向边直接抄，正反权重对称才像一条真实的路
    if (index > edge.reverse) {
      weights[index] = weights[edge.reverse];
      return;
    }
    weights[index] = clamp(
      Math.round(edge.length * 20) + 1,
      MIN_WEIGHT,
      MAX_WEIGHT
    );
  });
  return weights;
}

/**
 * 把一部分边翻成负权。
 *
 * 只翻一个方向，而且负得比反向那条轻（−(w−1) 对 +w），所以来回走一趟
 * 仍然是正的 —— 单靠这一步长不出负环。但三条负边首尾相接还是可能凑出
 * 一个来，所以最后统一检查一遍，发现就把最负的那条退回去。
 *
 * 这个页面上负环是一个**开关**，不能靠掷骰子掷出来。
 */
function applyNegatives(
  graph: GraphModel,
  weights: Float64Array,
  config: ShortestConfig
): number[] {
  if (config.negativeRatio <= 0) return [];

  const forward = [...graph.edges.keys()].filter(
    index =>
      index < graph.edges[index].reverse && weights[index] >= MIN_WEIGHT + 1
  );

  const random = seededRandom(config.seed * 7919 + 13);
  shuffle(forward, random);

  const quota = Math.round(forward.length * config.negativeRatio);
  const flipped: number[] = [];
  for (const index of forward.slice(0, quota)) {
    weights[index] = -(weights[index] - 1);
    flipped.push(index);
  }

  // 退到没有负环为止：每次撤销当前最负的那一条
  while (flipped.length > 0 && hasNegativeCycle(graph, weights)) {
    let worst = 0;
    for (let i = 1; i < flipped.length; i++) {
      if (weights[flipped[i]] < weights[flipped[worst]]) worst = i;
    }
    const index = flipped[worst];
    weights[index] = weights[graph.edges[index].reverse];
    flipped.splice(worst, 1);
  }

  return flipped;
}

/**
 * 造一个负环：优先找三角形，找不到就把某条边的正反两向都设成负。
 *
 * 三角形更像教科书里的图，也更能说明"环上绕一圈总代价为负"这件事 ——
 * 两点之间来回摆动虽然也是负环，看着却像个 bug。
 */
function injectCycle(graph: GraphModel, weights: Float64Array): number[] {
  const triangle = findTriangle(graph);
  if (triangle) {
    for (const edge of triangle) {
      weights[edge] = -Math.max(1, Math.abs(weights[edge]) - 1);
    }
    return triangle;
  }

  const edge = 0;
  const back = graph.edges[edge].reverse;
  weights[edge] = -1;
  weights[back] = -1;
  return [edge, back];
}

/** 找一个有向三角形 a→b→c→a，返回三条边的下标 */
function findTriangle(graph: GraphModel): number[] | null {
  for (const first of graph.outgoing.flat()) {
    const a = graph.edges[first].from;
    const b = graph.edges[first].to;
    for (const second of graph.outgoing[b]) {
      const c = graph.edges[second].to;
      if (c === a) continue;
      const third = graph.outgoing[c].find(edge => graph.edges[edge].to === a);
      if (third !== undefined) return [first, second, third];
    }
  }
  return null;
}

function shuffle(items: number[], random: () => number) {
  for (let i = items.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [items[i], items[j]] = [items[j], items[i]];
  }
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}
