/** 四个朝向，顺时针：右 下 左 上 */
export type Dir = 0 | 1 | 2 | 3;

export interface TurnGrid {
  cols: number;
  rows: number;
  /** 1 = 墙 */
  walls: Uint8Array;
  start: number;
  goal: number;
}

export interface TurnConfig {
  cols: number;
  rows: number;
  seed: number;
  /** 障碍占比 */
  density: number;
  /** 转 90° 要额外付出多少步的代价 */
  turnCost: number;
  /** 掉头（180°）的代价 */
  uTurnCost: number;
  /** 出发时车头朝哪 */
  startDir: Dir;
}

export interface TurnCosts {
  turn: number;
  uTurn: number;
}

/** 一条路线的账单 */
export interface RouteCost {
  /** 走了多少格 */
  steps: number;
  /** 转了几次 90° */
  turns: number;
  /** 掉了几次头 */
  uTurns: number;
  /** 总代价 = 步数 + 转弯代价 */
  cost: number;
}

export interface TurnStats {
  /** 已定稿的**状态**数，不是格子数 */
  expanded: number;
  /** 状态空间总共有多大：可通行格子 × 4 */
  total: number;
  frontier: number;
  done: boolean;
  found: boolean;
  /** 状态空间搜索给出的最优路线 */
  best: RouteCost | null;
  /** 先把步数压到最少、再在其中挑转弯最少的那条 */
  stepsFirst: RouteCost | null;
  /** 在格子层面记账的朴素做法给出的那条 */
  naive: RouteCost | null;
}
