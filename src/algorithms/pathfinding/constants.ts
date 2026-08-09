import type { SearchAlgorithm, SearchConfig } from './types';

export const defaultConfig: SearchConfig = {
  algorithm: 'astar',
  heuristic: 'manhattan',
  allowDiagonal: false,
  heuristicWeight: 1,
};

/** 默认网格尺寸，cellSize 由容器大小推导 */
export const DEFAULT_COLS = 48;
export const DEFAULT_ROWS = 28;

/** 沼泽的通行代价：足够大到能让绕路更划算，又不至于等同于墙 */
export const SWAMP_COST = 6;

/** 播放时每帧展开的节点数上限，随"速度"滑块变化 */
export const DEFAULT_SPEED = 4;

// ─── 动画 ─────────────────────────────────────────────────────
/**
 * 波前脉冲：刚展开的格子在其后多少个节点之内保持高亮。
 * 没有它，格子从未访问直接跳到最终色，波前看起来像贴图而不是在推进。
 */
export const PULSE_SPAN = 70;
/** 找到终点后，路径每帧从终点回溯几格 —— 这是最有仪式感的一段 */
export const PATH_REVEAL_PER_FRAME = 1.6;
/** 光点沿路径行走的速度（格/帧） */
export const WALKER_SPEED = 0.32;
/** 光点走完一趟后停顿多少帧再从头来 */
export const WALKER_PAUSE_FRAMES = 40;

/** 对比模式下并排跑的四个算法 */
export const comparedAlgorithms: SearchAlgorithm[] = [
  'astar',
  'dijkstra',
  'bfs',
  'greedy',
];

export const algorithmLabels: Record<
  SearchAlgorithm,
  { label: string; enName: string; key: string; blurb: string }
> = {
  astar: {
    label: 'A*',
    enName: 'A-star',
    key: 'g + h',
    blurb:
      '同时看已走代价和终点估计，朝终点定向扩张。启发式可采纳时保证最短路。',
  },
  dijkstra: {
    label: 'Dijkstra',
    enName: 'Dijkstra',
    key: 'g',
    blurb: '只看已走代价，向四周均匀扩散。必然最短，但白跑的格子多。',
  },
  bfs: {
    label: 'BFS',
    enName: 'Breadth-First',
    key: '入队序',
    blurb: '按层扩展，不看权重。只有在等权图上才等价于最短路。',
  },
  greedy: {
    label: '贪心最佳优先',
    enName: 'Greedy Best-First',
    key: 'h',
    blurb: '只看终点估计，冲得最快，但遇到凹形障碍就会绕远，不保证最短。',
  },
};

export const heuristicLabels = {
  manhattan: '曼哈顿',
  octile: '八方距离',
  euclidean: '欧几里得',
  none: '零（退化为 Dijkstra）',
} as const;

// ─── 绘制 ─────────────────────────────────────────────────────
export const gridColors = {
  background: '#181c24',
  cell: '#20252f',
  line: '#2b3140',
  wall: '#454c5e',
  swamp: '#2f4a3d',
  /** closed 区域按展开顺序在这两色之间渐变，能看出扩张的波前 */
  closedFrom: '#1e3a5f',
  closedTo: '#6d3f8a',
  open: '#5ad1c8',
  /** 刚展开那一瞬间的高亮，会在 PULSE_SPAN 内衰减回渐变色 */
  pulse: '#b7f4ff',
  path: '#f0c05a',
  walker: '#fff3c4',
  start: '#5ad1c8',
  goal: '#f97362',
} as const;
