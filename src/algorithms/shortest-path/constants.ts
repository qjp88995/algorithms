import type { ShortestAlgorithm, ShortestConfig } from './types';

export const defaultConfig: ShortestConfig = {
  algorithm: 'dijkstra',
  nodeCount: 12,
  degree: 3,
  seed: 1,
  negativeRatio: 0,
  negativeCycle: false,
};

/**
 * 节点数上限压在 20：这一页要把权重、距离值和节点名都写在图上，
 * 再多字就叠在一起了 —— 而"读得出每条边多贵"正是这页存在的理由。
 */
export const MIN_NODES = 5;
export const MAX_NODES = 20;

/** 边权取值范围。整数，方便心算验证算法给的答案 */
export const MIN_WEIGHT = 1;
export const MAX_WEIGHT = 9;

/** 每帧检查多少条边 */
export const DEFAULT_SPEED = 3;

/** 松弛成功后那条边高亮几帧 —— 速度拉高时全靠余晖才看得出哪几条被改过 */
export const FLASH_FRAMES = 26;

/** 跑完之后，最终路径每帧亮起几段 */
export const PATH_REVEAL_PER_FRAME = 0.25;

export const algorithmLabels: Record<
  ShortestAlgorithm,
  { label: string; enName: string; complexity: string; blurb: string }
> = {
  dijkstra: {
    label: 'Dijkstra',
    enName: 'Dijkstra',
    complexity: 'O(E log V)',
    blurb:
      '每次挑出距离最小的节点并宣布它已定稿。这个「定稿」只有在边权非负时才成立 —— 负权一出现就会答错。',
  },
  'bellman-ford': {
    label: 'Bellman-Ford',
    enName: 'Bellman-Ford',
    complexity: 'O(V·E)',
    blurb:
      '不挑节点，把每条边轮着松弛 V−1 轮。慢，但允许负权；第 V 轮还能松弛就说明有负环。',
  },
  'floyd-warshall': {
    label: 'Floyd-Warshall',
    enName: 'Floyd-Warshall',
    complexity: 'O(V³)',
    blurb:
      '三重循环填一张全源距离表：允许经过前 k 个点时，i 到 j 最短是多少。负环表现为对角线变负。',
  },
};

// ─── 绘制 ─────────────────────────────────────────────────────
export const graphColors = {
  background: '#181c24',
  edge: '#39415a',
  /** 负权边 —— 和正权边必须一眼分得开 */
  edgeNegative: '#c98bd8',
  edgeLabel: '#8b93ab',
  /** 已经进入最短路树的边（父指针） */
  tree: '#4b7fb5',
  /** 起点到终点的那一条 */
  path: '#f0c05a',
  /** 正在检查的边 */
  active: '#ffffff',
  /** 这次松弛把距离改小了 */
  improved: '#8ef7e4',
  /** Floyd 正在试的绕行：i ⇝ k ⇝ j */
  detour: '#7d6bd6',
  /** 负环 */
  cycle: '#f9614f',

  node: '#232936',
  nodeStroke: '#39415a',
  /** 距离已被更新过、但还没定稿 */
  nodeReached: '#2c4a63',
  /** Dijkstra 已出队定稿 */
  nodeSettled: '#3f5f7e',
  /** 正在展开的那个 */
  nodeActive: '#e4d2ff',
  /** Floyd 的 pivot k */
  nodePivot: '#7d6bd6',
  source: '#5ad1c8',
  target: '#f97362',
  label: '#e8ecf5',
  dist: '#9fb4d0',
  /** 距离与精确解不符 —— Dijkstra 遇负权时会亮出来 */
  wrong: '#f9614f',
} as const;
