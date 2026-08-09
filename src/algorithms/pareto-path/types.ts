/**
 * 双目标最短路：每条边同时挂两个代价 —— 通行时间和过路费。
 *
 * 这两个数没有换算率（一分钟值几块钱？没有客观答案），所以「最短」这个词
 * 在这里失去了意义：答案不是一条路，而是一组互不支配的路。
 */
export interface ParetoConfig {
  nodeCount: number;
  degree: number;
  seed: number;
  /** 收费强度；0 时全网免费，第二个目标消失，前沿塌成一个点 */
  spread: number;
  /** 偏好权重 λ：1 = 只看时间，0 = 只看钱。只影响挑哪个解，不影响搜索 */
  lambda: number;
}

/** 帕累托前沿上的一个解 */
export interface ParetoSolution {
  path: number[];
  time: number;
  toll: number;
  /**
   * 是否落在下凸包的角点上。
   *
   * 只有这样的解才存在某个 λ，让 `λ·时间 + (1-λ)·过路费` 的最优正好是它 ——
   * 其余的解（凸包凹处那些）无论怎么调权重都拿不到，这是这一页的核心。
   */
  supported: boolean;
}

/** 代价空间里的一个点：终点收到过的某个标签，含后来被淘汰的 */
export interface CostPoint {
  time: number;
  toll: number;
}

export interface ParetoStats {
  /** 检查过多少条边 */
  checks: number;
  /** 一共生成过多少个标签 */
  created: number;
  /** 生成时就被支配、当场丢掉的 */
  pruned: number;
  /** 曾经存活、后来被更好的标签淘汰的 */
  dropped: number;
  /** 此刻还活着的标签数 —— 「标签爆炸」看的就是它 */
  alive: number;
  /** 已经展开过的标签数 */
  expanded: number;
  done: boolean;
  /** 标签数撞上上限，搜索被迫中止 */
  overflow: boolean;
  /** 终点的非支配解个数 */
  frontier: number;
  /** 其中加权和能够选到的（凸包角点）个数 */
  supported: number;
}
