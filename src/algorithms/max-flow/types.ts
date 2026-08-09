/**
 * 三个算法解的是同一个问题，区别只在**下一条增广路从哪来**：
 *   ford-fulkerson  深度优先，撞见哪条算哪条 —— 可能绕远，也可能反复纠错
 *   edmonds-karp    广度优先，永远挑边数最少的那条，于是有了 O(V·E²) 的上界
 *   dinic           先分层，再在层次图里一口气榨干所有最短增广路
 */
export type FlowAlgorithm = 'ford-fulkerson' | 'edmonds-karp' | 'dinic';

/**
 * 用哪张网络。
 *   random   随机平面图，按到源点的层次定向
 *   diamond  教科书里的钻石图：中间那条容量 1 的边专门用来看反向边
 */
export type FlowPreset = 'random' | 'diamond';

export interface FlowConfig {
  algorithm: FlowAlgorithm;
  preset: FlowPreset;
  nodeCount: number;
  /** 平均度数，决定网络有多密 */
  degree: number;
  /** 换一张图就换一个种子 */
  seed: number;
  /** 跑完后画出最小割 */
  showCut: boolean;
}

export interface FlowStats {
  /** 考察过多少条边 —— 三个算法的工作量就看这个 */
  checks: number;
  /** 当前流量 */
  value: number;
  /** 已经找到并推过几条增广路 */
  augmentations: number;
  /** Dinic 的相位数；另外两个恒为 0 */
  phase: number;
  done: boolean;
  /** 跑完之后流量是否等于标准答案 */
  optimal: boolean;
  /** 最小割的容量与边数；只在跑完之后有意义 */
  cutCapacity: number;
  cutEdges: number;
  /** 刚推的那条增广路用到了反向边 —— 也就是把之前的决定退了一部分 */
  usedReverse: boolean;
}
