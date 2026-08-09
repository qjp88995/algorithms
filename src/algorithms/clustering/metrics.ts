import type { Dataset } from './dataset';

/**
 * 聚类结果好不好，得有个数说了算。
 *
 * 直接比"标签一不一样"是没意义的：算法给出的簇号只是编号，把 0 和 1
 * 对调之后还是同一个划分。所以要比的是**成对关系** —— 任取两个点，
 * 两种划分是否都认为它们同组。
 */

/**
 * 调整兰德指数。
 *
 * 兰德指数数的是"两种划分意见一致的点对占比"，但它有个毛病：随便乱分
 * 也能拿到不低的分数。调整版把这个期望值减掉，于是：
 *
 *   1     完全一致
 *   0     和瞎猜没区别
 *   负数  比瞎猜还差
 *
 * 噪声点（标签 -1）在这里当成各自独立的一组，DBSCAN 把大片数据判成
 * 噪声时分数会掉下来 —— 这正是我们想让它承担的代价。
 */
export function adjustedRandIndex(
  truth: Int32Array,
  labels: Int32Array
): number {
  const count = Math.min(truth.length, labels.length);
  if (count < 2) return 0;

  const rows = new Map<number, number>();
  const columns = new Map<number, number>();
  const cells = new Map<string, number>();
  let noise = 0;

  for (let i = 0; i < count; i++) {
    // 噪声各自独立成组，用互不相同的负号编号占位
    const a = truth[i] < 0 ? -1 - noise++ : truth[i];
    const b = labels[i] < 0 ? -1 - noise++ : labels[i];
    rows.set(a, (rows.get(a) ?? 0) + 1);
    columns.set(b, (columns.get(b) ?? 0) + 1);
    const key = `${a}|${b}`;
    cells.set(key, (cells.get(key) ?? 0) + 1);
  }

  const sumCells = sumPairs(cells.values());
  const sumRows = sumPairs(rows.values());
  const sumColumns = sumPairs(columns.values());
  const total = pairs(count);

  const expected = (sumRows * sumColumns) / total;
  const maximum = (sumRows + sumColumns) / 2;
  if (maximum - expected === 0) return sumCells === expected ? 1 : 0;
  return (sumCells - expected) / (maximum - expected);
}

/**
 * 簇内平方和 —— 每个点到自己那个簇的质心的距离平方之和。
 *
 * K-means 优化的正是这个数，所以它在别的算法上没什么可比性：
 * DBSCAN 的月牙簇「惯性」很大，但那不代表它分错了。
 */
export function inertia(data: Dataset, labels: Int32Array): number {
  const sums = new Map<number, { x: number; y: number; n: number }>();
  for (let i = 0; i < labels.length; i++) {
    const label = labels[i];
    if (label < 0) continue;
    const entry = sums.get(label) ?? { x: 0, y: 0, n: 0 };
    entry.x += data.points[i * 2];
    entry.y += data.points[i * 2 + 1];
    entry.n++;
    sums.set(label, entry);
  }

  let total = 0;
  for (let i = 0; i < labels.length; i++) {
    const label = labels[i];
    if (label < 0) continue;
    const entry = sums.get(label)!;
    const dx = data.points[i * 2] - entry.x / entry.n;
    const dy = data.points[i * 2 + 1] - entry.y / entry.n;
    total += dx * dx + dy * dy;
  }
  return total;
}

/** 有多少个真正的簇（不算噪声） */
export function clusterCount(labels: Int32Array) {
  const seen = new Set<number>();
  for (const label of labels) {
    if (label >= 0) seen.add(label);
  }
  return seen.size;
}

function pairs(n: number) {
  return (n * (n - 1)) / 2;
}

function sumPairs(counts: Iterable<number>) {
  let total = 0;
  for (const n of counts) total += pairs(n);
  return total;
}
