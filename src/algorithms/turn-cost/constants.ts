import type { TurnConfig } from './types';

export const defaultConfig: TurnConfig = {
  cols: 30,
  rows: 20,
  // 这张图上三条路线的账单各不相同，而且各输在不同的地方：
  // 最优 46 步 5 弯共 71；步数优先只走 44 步却转 7 次，79；
  // 朴素做法转弯数和最优一样，却白绕了 4 步，75
  seed: 20,
  density: 0.24,
  // 一次转弯顶五步。转弯太便宜时「绕路换直行」不划算，
  // 三条路线会重合成一条 —— 那这一页也就没什么可看的了
  turnCost: 5,
  uTurnCost: 10,
  startDir: 0,
};

export const MIN_COLS = 16;
export const MAX_COLS = 40;

/** 每帧检查多少条出边 */
export const DEFAULT_SPEED = 14;

/** 松弛成功后那一格高亮几帧 */
export const FLASH_FRAMES = 20;

// ─── 绘制 ─────────────────────────────────────────────────────
export const turnColors = {
  background: '#181c24',
  floor: '#1e2430',
  wall: '#2f3646',
  gridLine: '#232936',

  /** 状态定稿的先后：早 → 晚 */
  waveFrom: '#2c4a63',
  waveTo: '#7ae0d4',
  /** 已经有代价、还没定稿的状态 */
  open: '#3a4356',

  /** 状态空间搜索给出的最优路线 */
  routeBest: '#f0c05a',
  /** 先压步数、再拉直弯的那条 */
  routeStepsFirst: '#6d8bd0',
  /** 格子层面记账的朴素做法 */
  routeNaive: '#c07ce0',

  start: '#5ad1c8',
  goal: '#f97362',
  active: '#ffffff',
} as const;
