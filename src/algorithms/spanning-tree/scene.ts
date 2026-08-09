import { generateGeometricGraph } from '@/lib/graph/generate';
import { farthestPair, type GraphModel } from '@/lib/graph/model';

import { MAX_WEIGHT, MIN_WEIGHT } from './constants';
import {
  compareLinks,
  type ReferenceTree,
  referenceTree,
  undirectedLinks,
} from './reference';
import type { SpanningConfig } from './types';

/** 一张图 + 一套边权 + 标准答案，构成演示的一「局」 */
export interface SpanningScene {
  graph: GraphModel;
  /** 按有向边下标存的权重；一条连线的正反两向永远同价 */
  weights: Float64Array;
  /** 全部无向边（代表下标），按边下标自然顺序 —— Borůvka 扫描用 */
  links: number[];
  /** 同一批边按 (权重, 下标) 排好序 —— Kruskal 直接顺着取 */
  sortedLinks: number[];
  /** 这张图的标准答案，用来判定跑出来的树对不对 */
  reference: ReferenceTree;
  /** 默认的根：图上离得最远那一对里的一个 */
  root: number;
}

export function buildScene(config: SpanningConfig): SpanningScene {
  const graph = generateGeometricGraph({
    nodeCount: config.nodeCount,
    degree: config.degree,
    seed: config.seed,
  });

  const weights = baseWeights(graph);
  const links = undirectedLinks(graph);
  const sortedLinks = [...links].sort(compareLinks(weights));

  return {
    graph,
    weights,
    links,
    sortedLinks,
    reference: referenceTree(graph, weights),
    // 最远的一对里取起点：根在角落上，两棵树的差别才铺得开
    root: farthestPair(graph).source,
  };
}

/**
 * 权重正比于图上的线长，并取整到 1…9。
 *
 * 这不是为了好看：权重和画面上的线长对得上，用户才能靠眼睛先挑出
 * 「一眼看去最短的那些边」，再去看算法收下的是不是同一批。整数则是
 * 为了能把选中的边心算加起来，和统计栏里的总权重对一遍。
 */
function baseWeights(graph: GraphModel): Float64Array {
  const weights = new Float64Array(graph.edges.length);
  graph.edges.forEach((edge, index) => {
    // 只算一次，反向边直接抄：生成树是无向的，正反不同价没有意义
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

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}
