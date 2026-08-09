/**
 * 四个算法其实是同一套最佳优先搜索，区别只在优先队列的排序键：
 *   bfs      key = 入队序号（退化成 FIFO 队列）
 *   dijkstra key = g          （已走代价）
 *   greedy   key = h          （到终点的估计）
 *   astar    key = g + w·h
 */
export type SearchAlgorithm = 'astar' | 'dijkstra' | 'bfs' | 'greedy';

export type Heuristic = 'manhattan' | 'octile' | 'euclidean' | 'none';

/** 画笔：墙不可通行，沼泽代价高但可走 */
export type Brush = 'wall' | 'swamp' | 'erase';

export interface GridModel {
  cols: number;
  rows: number;
  /** 1 = 墙 */
  walls: Uint8Array;
  /** 进入该格的代价，普通地形 1，沼泽更高 */
  weights: Float32Array;
  start: number;
  goal: number;
}

export interface SearchConfig {
  algorithm: SearchAlgorithm;
  heuristic: Heuristic;
  allowDiagonal: boolean;
  /** 加权 A*：>1 时更贪心，更快但可能不是最短路 */
  heuristicWeight: number;
}

/** 节点在搜索中的状态，同时用作渲染的着色依据 */
export const NODE_UNVISITED = 0;
export const NODE_OPEN = 1;
export const NODE_CLOSED = 2;

export interface SearchStats {
  /** 已展开（closed）的节点数 —— 衡量搜索效率的核心指标 */
  expanded: number;
  /** 当前边界（open）的节点数 */
  frontier: number;
  /** 路径经过的格子数 */
  pathLength: number;
  /** 路径的实际代价，考虑沼泽与对角距离 */
  pathCost: number;
  done: boolean;
  found: boolean;
}
