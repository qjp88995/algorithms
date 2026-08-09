import type { ParetoConfig } from './types';

export const defaultConfig: ParetoConfig = {
  nodeCount: 16,
  degree: 3,
  // 这个种子上前沿有六个解：最快的 116 分 ¥43，最省的 212 分 ¥5，
  // 中间还有两个加权和永远选不到的凹处解 —— 这一页要讲的话，
  // 得先有反例摆在画布上
  seed: 107,
  spread: 1,
  lambda: 0.5,
};

export const MIN_NODES = 8;
export const MAX_NODES = 26;

/** 每帧检查多少条边 */
export const DEFAULT_SPEED = 4;

/** 一次搜索最多生成多少标签；撞上就中止，免得拖死浏览器 */
export const MAX_LABELS = 8000;

/** 散点图上最多留多少个历史点 */
export const MAX_SAMPLES = 600;

/** 标签被接受后那条边高亮几帧 */
export const FLASH_FRAMES = 26;

// ─── 绘制 ─────────────────────────────────────────────────────
export const paretoColors = {
  background: '#181c24',

  /** 路的颜色按等级插值：慢而免费 → 快而收费 */
  roadFree: '#4c7f66',
  roadToll: '#b8853c',
  edgeLabel: '#8b93ab',

  /** 前沿上「加权和选得到」的解 */
  supported: '#5ad1c8',
  /** 前沿上凹处的解 —— 无论怎么调权重都拿不到 */
  unsupported: '#c07ce0',
  /** 当前选中的那条 */
  selected: '#f0c05a',

  active: '#ffffff',
  accepted: '#8ef7e4',

  node: '#232936',
  nodeStroke: '#39415a',
  /** 节点保留的标签越多，填色越亮 —— 标签爆炸的直接读数 */
  nodeLabels: '#3f5f7e',
  nodeActive: '#e4d2ff',
  source: '#5ad1c8',
  target: '#f97362',
  label: '#e8ecf5',
  count: '#9fb4d0',

  /** 代价空间：被支配的历史标签 */
  dominated: '#39415a',
  /** 等权重线，斜率由 λ 决定 */
  isoLine: '#f0c05a',
  grid: '#2b3140',
  axis: '#8b93ab',
} as const;
