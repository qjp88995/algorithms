import type { FastestConfig } from './types';

/** 一天有多少分钟 —— 所有时刻都在这个周期里循环 */
export const DAY = 24 * 60;

/** 早晚高峰的中心时刻与宽度（分钟） */
export const MORNING_PEAK = 8 * 60;
export const EVENING_PEAK = 18 * 60;
export const MORNING_WIDTH = 100;
export const EVENING_WIDTH = 135;

/** 施工路段几点放行，封着的时候要多付多少分钟 */
export const ROADWORK_OPEN_AT = 9 * 60;
export const ROADWORK_PENALTY = 90;

export const defaultConfig: FastestConfig = {
  nodeCount: 16,
  degree: 3,
  // 这个种子上两个故事都成立：傍晚高峰时静态路线明显更慢，
  // 打开施工封路后 07:40 前后出发能看到 Dijkstra 给出非最优答案
  seed: 47,
  departure: 16 * 60 + 20,
  rush: 1.4,
  roadwork: false,
  waiting: false,
};

export const MIN_NODES = 8;
export const MAX_NODES = 26;

/** 每帧检查多少条边 */
export const DEFAULT_SPEED = 3;

/** 松弛成功后那条边高亮几帧 */
export const FLASH_FRAMES = 26;

/** 发车动画：每帧推进多少分钟 */
export const CLOCK_PER_FRAME = 0.7;
/** 两辆车都到齐之后停多少帧再重来 */
export const REPLAY_PAUSE_FRAMES = 70;

/**
 * 到达曲线的采样间隔（分钟）。
 * 144 个点：够密到画得出施工造成的那道断崖，又不至于让拖滑块时卡顿 ——
 * 每个采样点背后都是一次完整的多标签搜索。
 */
export const PROFILE_STEP = 10;

// ─── 绘制 ─────────────────────────────────────────────────────
export const roadColors = {
  background: '#181c24',
  /** 畅通 → 严重拥堵，边的颜色在这两者之间插值 */
  free: '#3c6f5a',
  jammed: '#c2543f',
  /** 正在施工封闭的路段 */
  closed: '#7b4a86',
  edgeLabel: '#8b93ab',

  /** 时间依赖 Dijkstra 选出的路线 */
  routeFast: '#f0c05a',
  /** 按自由流时间选的静态路线 */
  routeStatic: '#6d8bd0',
  /** 穷尽搜索找到的更优路线（Dijkstra 答错时才出现） */
  routeBest: '#8ef7e4',

  active: '#ffffff',
  improved: '#8ef7e4',

  node: '#232936',
  nodeStroke: '#39415a',
  nodeReached: '#2c4a63',
  nodeSettled: '#3f5f7e',
  nodeActive: '#e4d2ff',
  source: '#5ad1c8',
  target: '#f97362',
  label: '#e8ecf5',
  time: '#9fb4d0',

  carFast: '#fff3c4',
  carStatic: '#c3d4f5',
  clock: '#e8ecf5',

  /** 到达曲线 */
  profileLine: '#8ef7e4',
  /** 曲线上违反 FIFO 的那一段 */
  profileViolation: '#f9614f',
  profileGrid: '#2b3140',
  profileMarker: '#f0c05a',
} as const;
