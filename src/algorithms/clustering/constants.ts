import type { ClusterAlgorithm, ClusteringConfig, DatasetKind } from './types';

/**
 * 一进来就是 K-means 配月牙 —— 这一页最该看的一幕：
 * 它会把两个月牙拦腰切开，而且毫无察觉。
 */
export const defaultConfig: ClusteringConfig = {
  algorithm: 'kmeans',
  dataset: 'moons',
  pointCount: 240,
  seed: 1,
  initSeed: 1,
  k: 2,
  smartInit: true,
  eps: 0.06,
  minPts: 5,
  linkage: 'single',
};

/**
 * 点数上限压在 300：层次聚类每合并一次都要扫一遍所有簇对，
 * 再多就不是「一帧一步」的节奏了。300 个点在画布上也已经够密。
 */
export const MIN_POINTS = 60;
export const MAX_POINTS = 300;

export const MIN_K = 2;
export const MAX_K = 8;

/** 每帧走多少步 */
export const DEFAULT_SPEED = 3;

export const MIN_EPS = 0.02;
export const MAX_EPS = 0.16;

export const algorithmLabels: Record<
  ClusterAlgorithm,
  { label: string; complexity: string; blurb: string }
> = {
  kmeans: {
    label: 'K-means',
    complexity: 'O(n · k · 迭代)',
    blurb:
      '分配、求平均、再分配，直到没人换组。快、简单，但它眼里的簇永远是围着一个中心的球 —— 而且你得先说要几个。',
  },
  dbscan: {
    label: 'DBSCAN',
    complexity: 'O(n²)',
    blurb:
      '不问要几个簇，只问「多近算挨着、多少个算稠密」。稠密区域连成一片就是一个簇，剩下的判为噪声 —— 形状随意。',
  },
  hierarchical: {
    label: '层次聚类',
    complexity: 'O(n³)',
    blurb:
      '每个点先各自成簇，反复合并最近的两个，直到剩下 K 个。「最近」怎么定义（单/全/平均连接）会长出完全不同的簇。',
  },
};

/**
 * 每份数据都带一组「能用」的参数。
 *
 * 换数据集时自动套上去 —— 否则一切过去就是满屏噪声，看到的是参数没调，
 * 而不是算法的脾气。套上之后随时可以自己拖坏，那才是要看的东西。
 */
export const datasetLabels: Record<
  DatasetKind,
  { label: string; blurb: string; k: number; eps: number }
> = {
  blobs: {
    label: '高斯团',
    blurb: '三个球形的团 —— K-means 的假设在这儿完全成立，它也确实最快最准。',
    k: 3,
    eps: 0.08,
  },
  moons: {
    label: '月牙',
    blurb: '两个交错的月牙。两簇的「中心」几乎重合，按中心划分必然拦腰切错。',
    k: 2,
    eps: 0.06,
  },
  circles: {
    label: '同心圆',
    blurb:
      '一个圆环整个包住另一个。没有任何一条直线能把它们分开，而 K-means 只会画直线。',
    k: 2,
    eps: 0.08,
  },
  varied: {
    label: '疏密不均',
    blurb:
      '三个团，密度和大小差得很远。同一个 eps 对紧的那团刚好，对松的那团就偏小 —— 边缘一圈会被判成噪声。',
    k: 3,
    eps: 0.06,
  },
  uniform: {
    label: '均匀噪声',
    blurb:
      '压根没有簇。三个算法照样会给你一个划分，而且看着挺像回事 —— 它们不会告诉你「其实没有结构」。',
    k: 3,
    eps: 0.08,
  },
};

// ─── 绘制 ─────────────────────────────────────────────────────
export const clusterColors = {
  background: '#181c24',
  /** 还没被处理到的点 */
  pending: '#39415a',
  /** 判为噪声 */
  noise: '#5b6379',
  /** 这一拍正在处理的点 */
  cursor: '#ffffff',
  /** DBSCAN 的邻域圆 */
  reach: '#8ef7e4',
  /** K-means 的中心 */
  center: '#f0c05a',
  /** 中心一路移动过来的轨迹 */
  trail: '#8a6f2e',
  /** 层次聚类刚刚合并的那一对 */
  merge: '#c98bd8',
  label: '#e8ecf5',
} as const;

/**
 * 簇的配色。
 *
 * 第一个是给簇 0 的，依次循环。真值对照打开时点会描一圈真值的颜色 ——
 * 填充和描边不一致的地方，就是算法分错的地方。
 */
export const paletteColors = [
  '#5b8ff9',
  '#61ddaa',
  '#f6bd16',
  '#e8684a',
  '#9270ca',
  '#78d3f8',
  '#f6903d',
  '#008685',
  '#d16ba5',
  '#96a9b2',
] as const;

export function clusterColor(label: number) {
  if (label < 0) return clusterColors.noise;
  return paletteColors[label % paletteColors.length];
}
