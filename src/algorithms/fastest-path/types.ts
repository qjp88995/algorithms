/**
 * 这一页只有一个算法 —— 时间依赖 Dijkstra，但有两个对照：
 *   static     按自由流时间算出的静态最短路，再拿去真实路况里跑一遍
 *   reference  允许反复修改标签的穷尽搜索，非 FIFO 时的标准答案
 */
export interface FastestConfig {
  nodeCount: number;
  degree: number;
  seed: number;
  /** 出发时刻，一天内的第几分钟 */
  departure: number;
  /** 早晚高峰的拥堵强度；0 表示全天畅通，路网退化成静态图 */
  rush: number;
  /** 施工封路：造出一段「晚点出发反而早到」的边，破坏 FIFO */
  roadwork: boolean;
  /** 允许在节点干等 —— 等待能把非 FIFO 的路网重新变回 FIFO */
  waiting: boolean;
}

export interface FastestStats {
  /** 检查过多少条边 */
  checks: number;
  improvements: number;
  /** 已定稿的节点数 */
  settled: number;
  total: number;
  done: boolean;
  reached: boolean;
  /** 时间依赖 Dijkstra 给出的到达时刻 */
  arrival: number;
  /** 行程时长（分钟） */
  duration: number;
  /** 按自由流时间选路、再放进真实路况里跑，实际几点到 */
  staticArrival: number;
  /** 两条路线是否是同一条 */
  sameRoute: boolean;
  /** 穷尽搜索给出的真正最早到达；FIFO 成立时应与 arrival 相同 */
  bestArrival: number;
  /** Dijkstra 比最优晚了多少分钟，> 0 就是 FIFO 假设失效了 */
  lateBy: number;
}

/** 到达曲线上的一个采样点：几点出发、几点到、走了多久 */
export interface ProfileSample {
  departure: number;
  arrival: number;
  duration: number;
}
