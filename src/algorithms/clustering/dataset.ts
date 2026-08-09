import { seededRandom } from '@/lib/random';

import type { DatasetKind } from './types';

/**
 * 五份合成数据，每一份都自带**真实分组**。
 *
 * 真值不是拿来给算法看的 —— 三个算法全程只能看到坐标。它的用处是
 * 事后算一个吻合度：没有它，"K-means 在月牙上失败了"就只是一句
 * 观感，有了它才是一个数字。
 *
 * 坐标一律归一化到 [0,1]²，画布只管把它乘上去。
 */
export interface Dataset {
  /** 交错存储的 x, y */
  points: Float64Array;
  /** 每个点属于哪一组；-1 表示这份数据本来就没有分组可言 */
  truth: Int32Array;
  /** 真实分组数 */
  groups: number;
  kind: DatasetKind;
}

export function buildDataset(
  kind: DatasetKind,
  count: number,
  seed: number
): Dataset {
  const random = seededRandom(seed * 7717 + 3);
  switch (kind) {
    case 'blobs':
      return blobs(count, random);
    case 'moons':
      return moons(count, random);
    case 'circles':
      return circles(count, random);
    case 'varied':
      return varied(count, random);
    case 'uniform':
      return uniform(count, random);
  }
}

export function pointX(data: Dataset, index: number) {
  return data.points[index * 2];
}

export function pointY(data: Dataset, index: number) {
  return data.points[index * 2 + 1];
}

export function distance(data: Dataset, a: number, b: number) {
  const dx = data.points[a * 2] - data.points[b * 2];
  const dy = data.points[a * 2 + 1] - data.points[b * 2 + 1];
  return Math.hypot(dx, dy);
}

/** 三个高斯团 —— K-means 假设成立的那种数据 */
function blobs(count: number, random: () => number): Dataset {
  const centers = [
    [0.25, 0.28],
    [0.74, 0.3],
    [0.5, 0.76],
  ];
  return fromGroups(
    count,
    centers.length,
    group => {
      const [cx, cy] = centers[group];
      return [cx + gaussian(random) * 0.075, cy + gaussian(random) * 0.075];
    },
    'blobs',
    random
  );
}

/** 三个团，但大小和密度差得很远 —— 单一的 eps 在这儿会顾此失彼 */
function varied(count: number, random: () => number): Dataset {
  const shape = [
    { x: 0.18, y: 0.24, spread: 0.022 },
    { x: 0.63, y: 0.55, spread: 0.115 },
    { x: 0.26, y: 0.78, spread: 0.042 },
  ];
  return fromGroups(
    count,
    shape.length,
    group => {
      const { x, y, spread } = shape[group];
      return [x + gaussian(random) * spread, y + gaussian(random) * spread];
    },
    'varied',
    random
  );
}

/**
 * 两个交错的月牙：非凸，而且两簇的"中心"几乎重合。
 *
 * 一个上拱的弧，一个下垂的弧，右上和左下互相咬合。两条弧之间始终留着
 * 一道明显的缝 —— 缝比弧上相邻两点的间距宽得多，所以「按密度连通」
 * 分得开，「按到中心的距离」分不开。
 */
function moons(count: number, random: () => number): Dataset {
  const radius = 0.287;
  const cx = 0.357;
  const cy = 0.572;
  return fromGroups(
    count,
    2,
    (group, position) => {
      const t = arcAngle(position, Math.PI);
      const jitter = 0.028;
      if (group === 0) {
        return [
          cx + Math.cos(t) * radius + gaussian(random) * jitter,
          cy - Math.sin(t) * radius + gaussian(random) * jitter,
        ];
      }
      return [
        cx + radius * (1 - Math.cos(t)) + gaussian(random) * jitter,
        cy - radius * 0.5 + Math.sin(t) * radius + gaussian(random) * jitter,
      ];
    },
    'moons',
    random
  );
}

/** 两个同心圆环：一个把另一个整个包住，任何"按中心划分"的做法都无解 */
function circles(count: number, random: () => number): Dataset {
  return fromGroups(
    count,
    2,
    (group, position) => {
      const t = arcAngle(position, Math.PI * 2);
      const radius = group === 0 ? 0.42 : 0.17;
      const jitter = 0.022;
      return [
        0.5 + Math.cos(t) * radius + gaussian(random) * jitter,
        0.5 + Math.sin(t) * radius + gaussian(random) * jitter,
      ];
    },
    'circles',
    random
  );
}

function arcAngle(position: number, span: number) {
  return position * span;
}

/**
 * 均匀随机。
 *
 * 这份数据没有簇。放在这里是为了看一件事：三个算法照样会给出
 * 一个划分，而且看上去还挺像回事 —— 聚类算法不会告诉你"其实没有结构"。
 */
function uniform(count: number, random: () => number): Dataset {
  const points = new Float64Array(count * 2);
  for (let i = 0; i < count; i++) {
    points[i * 2] = 0.04 + random() * 0.92;
    points[i * 2 + 1] = 0.04 + random() * 0.92;
  }
  return {
    points,
    truth: new Int32Array(count).fill(-1),
    groups: 0,
    kind: 'uniform',
  };
}

/**
 * 把点均摊到各组，逐点采样，最后统一裁进画布。
 *
 * 传给 `sample` 的 `position` 是这个点在本组里的相对位置（0…1），
 * 已经带上了不超过一格的抖动。弧形数据靠它把点**等距**铺开：纯随机
 * 取角看着更自然，却会在弧上留下大小不一的空档，最大的那个往往比
 * 密度阈值还宽，于是一条本该连成一片的弧会被 DBSCAN 断成好几截 ——
 * 那不是算法的毛病，是采样的毛病。
 */
function fromGroups(
  count: number,
  groups: number,
  sample: (group: number, position: number) => [number, number],
  kind: DatasetKind,
  random: () => number
): Dataset {
  const points = new Float64Array(count * 2);
  const truth = new Int32Array(count);
  const perGroup = new Int32Array(groups);
  for (let i = 0; i < count; i++) perGroup[i % groups]++;
  const seen = new Int32Array(groups);

  for (let i = 0; i < count; i++) {
    const group = i % groups;
    const position = (seen[group]++ + random() * 0.85) / perGroup[group];
    const [x, y] = sample(group, position);
    points[i * 2] = clamp(x, 0.02, 0.98);
    points[i * 2 + 1] = clamp(y, 0.02, 0.98);
    truth[i] = group;
  }
  return { points, truth, groups, kind };
}

/** Box-Muller：两个均匀随机数换一个标准正态 */
function gaussian(random: () => number) {
  const u = Math.max(random(), 1e-12);
  const v = random();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}
