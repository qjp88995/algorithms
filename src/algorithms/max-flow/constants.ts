import type { FlowAlgorithm, FlowConfig } from './types';

export const defaultConfig: FlowConfig = {
  algorithm: 'ford-fulkerson',
  preset: 'diamond',
  nodeCount: 12,
  degree: 3,
  seed: 1,
  showCut: true,
};

/**
 * 节点数上限压在 20：每条边上都要写「已推 / 容量」，还要按容量画粗细，
 * 再多字就叠在一起了 —— 而"这条路还能再挤多少"正是这页要看的东西。
 */
export const MIN_NODES = 5;
export const MAX_NODES = 20;

/** 容量取值范围。整数，方便把割上的几条边心算加起来 */
export const MIN_CAPACITY = 1;
export const MAX_CAPACITY = 9;

/** 钻石图上那几条宽边的容量。够大才显得中间那条 1 有多离谱 */
export const DIAMOND_CAPACITY = 20;

/** 每帧考察多少条边 */
export const DEFAULT_SPEED = 2;

/** 一条增广路推完之后高亮几帧 —— 速度拉高时全靠余晖才看得清推了哪条 */
export const FLASH_FRAMES = 34;

export const algorithmLabels: Record<
  FlowAlgorithm,
  { label: string; complexity: string; blurb: string }
> = {
  'ford-fulkerson': {
    label: 'Ford-Fulkerson',
    complexity: 'O(E · f)',
    blurb:
      '深度优先找增广路：一头扎下去，撞见能走的边就走。路径可能绕远、推的量可能很小，纠错全靠反向边。',
  },
  'edmonds-karp': {
    label: 'Edmonds-Karp',
    complexity: 'O(V · E²)',
    blurb:
      '同一个框架，只是改用广度优先 —— 每次都挑边数最少的增广路。这一个改动就把上界从「和流量有关」变成了「只和图有关」。',
  },
  dinic: {
    label: 'Dinic',
    complexity: 'O(V² · E)',
    blurb:
      '先 BFS 分层，再在层次图里一次榨干所有当前最短的增广路。每个相位过后最短路至少长一条边，所以最多 V 个相位。',
  },
};

// ─── 绘制 ─────────────────────────────────────────────────────
export const flowColors = {
  background: '#181c24',
  /** 还没推过流的边 */
  edge: '#39415a',
  edgeLabel: '#8b93ab',
  /** 推了流、但还没满 */
  flowing: '#4b7fb5',
  /** 已经饱和：残量为 0，再也推不进去 */
  saturated: '#f0c05a',
  /** 这一拍正在考察的边 */
  active: '#ffffff',
  /** 刚刚推过的那条增广路 */
  path: '#8ef7e4',
  /** 增广路里用到的反向边 —— 这一步是在把之前推的流退回去 */
  reverse: '#c98bd8',
  /** 最小割上的边 */
  cut: '#f9614f',

  node: '#232936',
  nodeStroke: '#39415a',
  /** 这一拍那条边的两端 */
  nodeActive: '#e4d2ff',
  source: '#5ad1c8',
  sink: '#f97362',
  /** 割的源点一侧 */
  sideSource: '#2c4a63',
  /** 割的汇点一侧 */
  sideSink: '#4a3340',
  label: '#e8ecf5',
  /** 节点旁的层次编号（Dinic） */
  level: '#9fb4d0',
} as const;
