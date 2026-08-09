/**
 * 三个算法解的是同一个问题，但对图的假设一个比一个弱：
 *   dijkstra        要求边权非负；一个节点出队就再也不改
 *   bellman-ford    允许负权；靠"松弛 |V|-1 轮"兜住，还能报出负环
 *   floyd-warshall  一次算出所有点对；负环表现为对角线变负
 */
export type ShortestAlgorithm = 'dijkstra' | 'bellman-ford' | 'floyd-warshall';

export interface ShortestConfig {
  algorithm: ShortestAlgorithm;
  nodeCount: number;
  /** 平均度数，决定图有多密 */
  degree: number;
  /** 换一张图就换一个种子 */
  seed: number;
  /** 有多大比例的边被翻成负权（只翻一个方向，不会因此产生负环） */
  negativeRatio: number;
  /** 故意造一个负环出来看三个算法各自的反应 */
  negativeCycle: boolean;
}

/** 点击画布时把节点设成什么 */
export type Endpoint = 'source' | 'target';

export interface ShortestStats {
  /** 检查过多少条边（尝试松弛的次数）—— 三个算法的工作量就看这个 */
  checks: number;
  /** 其中真正把距离改小了的次数 */
  improvements: number;
  /** 当前进度：Dijkstra 是已确定节点数，Bellman-Ford 是轮次，Floyd 是 k */
  round: number;
  totalRounds: number;
  done: boolean;
  /** 起点到终点是否有有限距离 */
  reached: boolean;
  distance: number;
  /** 路径经过几条边 */
  hops: number;
  /** 是否检测到负环（只有 Bellman-Ford 和 Floyd 能报） */
  negativeCycle: boolean;
  /** 与精确解不一致的节点数 —— Dijkstra 碰上负权时这里会大于 0 */
  wrong: number;
}
