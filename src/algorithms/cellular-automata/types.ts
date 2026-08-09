/**
 * 二维 Life-like 规则。
 *
 * 用两个 9 位掩码表示 B/S 记号：`birth` 的第 n 位为 1，表示死细胞
 * 恰好有 n 个活邻居时出生；`survive` 同理表示活细胞留下来的条件。
 * 生命游戏 B3/S23 就是 `{ birth: 1<<3, survive: 1<<2 | 1<<3 }`。
 *
 * 用位掩码而不是数组，是因为步进的内循环每个格子都要查一次 ——
 * 一次移位加与，比 `Set.has` 或 `includes` 便宜得多。
 */
export interface LifeRule {
  birth: number;
  survive: number;
}

/** 两种元胞自动机：二维 Life-like，一维初等 CA */
export type Dimension = '2d' | '1d';

/** 边界：环形（左右上下相接）或有界（界外恒为死） */
export type EdgeMode = 'torus' | 'bounded';

/** 一维 CA 的初始行 */
export type SeedKind = 'single' | 'random';

/** 二维格局的演化状态 —— 由周期检测器给出 */
export type LifeStatus =
  | { kind: 'running' }
  | { kind: 'extinct' }
  | { kind: 'still' }
  /** 检测到长度为 period 的循环 */
  | { kind: 'cycle'; period: number };

export interface LifeStats {
  generation: number;
  population: number;
  /** 本代发生翻转的格子数 —— 静止物再多，这个数也是 0 */
  changed: number;
  status: LifeStatus;
}

export interface ElementaryStats {
  generation: number;
  population: number;
}

/** 图案库里的一条。`cells` 用 `O` 表示活、`.` 表示死，一行一个字符串 */
export interface Pattern {
  id: string;
  label: string;
  cells: string[];
  blurb: string;
}

export interface CellularConfig {
  dimension: Dimension;
  /** 二维规则，B/S 掩码 */
  rule: LifeRule;
  /** 一维规则编号 0..255 */
  ruleNumber: number;
  edge: EdgeMode;
  seed: SeedKind;
  /** 随机撒点的密度 */
  density: number;
  /** 每个格子的边长（CSS 像素） */
  cellSize: number;
  /** 每秒推进多少代 */
  speed: number;
  /** 按存活时长着色 */
  ageColoring: boolean;
  /** 死亡余晖：让运动物体拖出尾巴 */
  decayTrails: boolean;
  showGrid: boolean;
}
