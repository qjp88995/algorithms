/**
 * 三个算法对「一个簇长什么样」的假设完全不同，这才是它们的分水岭：
 *   kmeans        簇是围着一个中心的球。必须先说要几个。
 *   dbscan        簇是连成一片的稠密区域，形状随意，稀的地方算噪声。
 *   hierarchical  先把每个点当一个簇，反复合并最近的两个，直到剩下 K 个。
 */
export type ClusterAlgorithm = 'kmeans' | 'dbscan' | 'hierarchical';

/** 合并两个簇时，「两簇之间的距离」怎么算 */
export type Linkage = 'single' | 'complete' | 'average';

/**
 * 数据集。前两个有球形的簇，中间两个没有 —— 换到那儿去看 K-means。
 *   blobs   三个高斯团，标准场景
 *   moons   两个交错的月牙，非凸
 *   circles 一大一小两个同心圆环，非凸且互相包住
 *   varied  三个团，密度和大小差得很远
 *   uniform 均匀随机，压根没有结构
 */
export type DatasetKind = 'blobs' | 'moons' | 'circles' | 'varied' | 'uniform';

/**
 * 会改变**算法在算什么**的参数。
 *
 * 「把真值画出来对照」这类纯展示的开关不在这里 —— 它们一旦混进来，
 * 切一下就得重建内核，播到一半的动画会被打断。
 */
export interface ClusteringConfig {
  algorithm: ClusterAlgorithm;
  dataset: DatasetKind;
  pointCount: number;
  /** 数据本身的种子 */
  seed: number;
  /**
   * K-means 挑初始中心用的种子，和数据的种子分开。
   * 只有分开，才能固定一份数据、单独重掷初值 —— 而这正是要看的东西。
   */
  initSeed: number;
  /** K-means 与层次聚类的目标簇数 */
  k: number;
  /** K-means 用 K-means++ 挑初始中心，而不是随手抓 K 个点 */
  smartInit: boolean;
  /** DBSCAN 的邻域半径（归一化坐标下的距离） */
  eps: number;
  /** DBSCAN 里成为核心点所需的邻居数（含自己） */
  minPts: number;
  linkage: Linkage;
}

export interface ClusteringStats {
  /** 已经走了多少步 */
  steps: number;
  /** 当前分出了几个簇 */
  clusters: number;
  /** 被判为噪声的点数；只有 DBSCAN 会有 */
  noise: number;
  /** 还没被处理到的点数 */
  pending: number;
  /**
   * 和真实分组的吻合度（调整兰德指数）。
   * 1 是完全一致，0 相当于随便乱分，负数比乱分还差。
   */
  agreement: number;
  /** 簇内平方和；K-means 优化的正是这个数 */
  inertia: number;
  done: boolean;
  /** 这一拍在干什么，直接显示给用户 */
  phase: string;
}
