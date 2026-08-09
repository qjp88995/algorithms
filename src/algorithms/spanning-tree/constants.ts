import type { SpanningAlgorithm, SpanningConfig } from './types';

export const defaultConfig: SpanningConfig = {
  algorithm: 'kruskal',
  nodeCount: 14,
  degree: 3,
  seed: 1,
  compare: false,
};

/**
 * 节点数上限压在 24：每条边上都要写权重、每个点下面还可能写两个距离，
 * 再多字就叠在一起了 —— 而「读得出每条边多贵」正是这页存在的理由。
 */
export const MIN_NODES = 5;
export const MAX_NODES = 24;

/** 边权取值范围。整数，方便把选中的边心算加起来核对总权重 */
export const MIN_WEIGHT = 1;
export const MAX_WEIGHT = 9;

/** 每帧考察多少条边 */
export const DEFAULT_SPEED = 2;

/** 收下一条边之后它闪几帧 —— 速度拉高时全靠余晖才看得出加了哪几条 */
export const FLASH_FRAMES = 26;

export const algorithmLabels: Record<
  SpanningAlgorithm,
  { label: string; complexity: string; blurb: string }
> = {
  kruskal: {
    label: 'Kruskal',
    complexity: 'O(E log E)',
    blurb:
      '把所有边按权重排好队，从最便宜的开始一条条试：两端不在同一块就收下，否则丢掉。树是从一堆碎片并起来的。',
  },
  prim: {
    label: 'Prim',
    complexity: 'O(E log V)',
    blurb:
      '从根开始滚雪球：每次接上「当前这棵树伸出去最便宜的那条边」。全程只有一棵树在长，不需要判环。',
  },
  boruvka: {
    label: 'Borůvka',
    complexity: 'O(E log V)',
    blurb:
      '所有分量同时行动：各自找一条最便宜的出边，然后一起接上。每轮分量数至少减半，所以只要 log V 轮。',
  },
};

// ─── 绘制 ─────────────────────────────────────────────────────
export const graphColors = {
  background: '#181c24',
  /** 还没被考察的边 */
  edge: '#39415a',
  edgeLabel: '#8b93ab',
  /** 考察过、因为成环被丢掉的边 */
  rejected: '#4a3340',
  /** 正在考察的边 */
  active: '#ffffff',
  /** Borůvka 本轮各分量选中的最便宜出边 */
  candidate: '#8ef7e4',
  /** 已经收进最小生成树的边 */
  tree: '#f0c05a',
  /** 对照用的最短路树 */
  shortestTree: '#4b7fb5',

  node: '#232936',
  nodeStroke: '#39415a',
  /** 正在考察的那条边的两端 */
  nodeActive: '#e4d2ff',
  root: '#5ad1c8',
  /** 沿生成树绕得最远的那个点 */
  detour: '#f97362',
  label: '#e8ecf5',
  dist: '#9fb4d0',
} as const;

/**
 * 分量配色。
 *
 * Kruskal 和 Borůvka 的过程就是「一堆碎片各自长大、再并成一片」，
 * 不给分量上色就完全看不出这件事。同一分量里的点共用一个颜色，
 * 合并的那一刻两片颜色会立刻统一 —— 这是并查集唯一看得见的样子。
 */
export const componentColors = [
  '#5b8ff9',
  '#61ddaa',
  '#f6bd16',
  '#e8684a',
  '#9270ca',
  '#78d3f8',
  '#f6903d',
  '#008685',
  '#d16ba5',
  '#96a9b2',
] as const;
