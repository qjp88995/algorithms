/**
 * 三个算法都在贪心，都长出同一棵树，区别只在「下一条边从哪来」：
 *   kruskal  全局把边排序，从最便宜的开始一条条试，成环就丢
 *   prim     从一个点开始滚雪球，永远接当前这棵树最便宜的那条出边
 *   boruvka  所有分量同时找各自最便宜的出边，一轮全接上，分量数减半
 */
export type SpanningAlgorithm = 'kruskal' | 'prim' | 'boruvka';

export interface SpanningConfig {
  algorithm: SpanningAlgorithm;
  nodeCount: number;
  /** 平均度数，决定图有多密 */
  degree: number;
  /** 换一张图就换一个种子 */
  seed: number;
  /** 叠加从根出发的最短路树做对照 —— 这一页的招牌反例 */
  compare: boolean;
}

export interface SpanningStats {
  /** 考察过多少条边 —— 三个算法的工作量就看这个 */
  checks: number;
  /** 已经收进树里的边数 */
  chosen: number;
  /** 一共需要几条（连通图是 V−1） */
  needed: number;
  /** 已选边的权重之和 */
  weight: number;
  /** 当前还剩几个互不相连的分量 */
  components: number;
  /** Borůvka 的轮次；另外两个恒为 0 */
  round: number;
  totalRounds: number;
  done: boolean;
  /** 跑完之后总权重是否等于标准答案 */
  optimal: boolean;
}
