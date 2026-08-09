import { describe, expect, it } from 'vitest';

import {
  ClusterRun,
  createRun,
  DbscanRun,
  HierarchicalRun,
  KMeansRun,
} from './cluster';
import { datasetLabels, defaultConfig } from './constants';
import { buildDataset, type Dataset, distance } from './dataset';
import { adjustedRandIndex, clusterCount } from './metrics';
import type {
  ClusterAlgorithm,
  ClusteringConfig,
  DatasetKind,
  Linkage,
} from './types';

const ALGORITHMS: ClusterAlgorithm[] = ['kmeans', 'dbscan', 'hierarchical'];

/** 按数据集配好那组「能用」的参数 —— 和页面上切数据集时是同一套 */
function configFor(
  kind: DatasetKind,
  patch: Partial<ClusteringConfig> = {}
): ClusteringConfig {
  const { k, eps } = datasetLabels[kind];
  return { ...defaultConfig, dataset: kind, k, eps, ...patch };
}

function solve(kind: DatasetKind, patch: Partial<ClusteringConfig> = {}) {
  const config = configFor(kind, patch);
  const data = buildDataset(kind, config.pointCount, config.seed);
  const run = createRun(data, config);
  run.runToEnd();
  return { run, data, config };
}

function agreement(kind: DatasetKind, patch: Partial<ClusteringConfig> = {}) {
  return solve(kind, patch).run.stats().agreement;
}

describe('三个算法的分水岭', () => {
  it('高斯团上谁都对 —— 这是 K-means 的主场', () => {
    for (const algorithm of ALGORITHMS) {
      expect(agreement('blobs', { algorithm }), algorithm).toBeGreaterThan(0.9);
    }
  });

  it('月牙上 K-means 必错，密度和单连接都对', () => {
    // 两个月牙的"中心"几乎重合，按到中心的距离划分只能拦腰切开
    expect(agreement('moons', { algorithm: 'kmeans' })).toBeLessThan(0.4);
    expect(agreement('moons', { algorithm: 'dbscan' })).toBeGreaterThan(0.95);
    expect(
      agreement('moons', { algorithm: 'hierarchical', linkage: 'single' })
    ).toBeGreaterThan(0.95);
  });

  it('同心圆上 K-means 彻底失效 —— 它只会画直的边界', () => {
    expect(agreement('circles', { algorithm: 'kmeans' })).toBeLessThan(0.2);
    expect(agreement('circles', { algorithm: 'dbscan' })).toBeGreaterThan(0.95);
  });

  it('连接方式决定层次聚类能不能追出非凸的形状', () => {
    const scores: Record<Linkage, number> = {
      single: agreement('circles', {
        algorithm: 'hierarchical',
        linkage: 'single',
      }),
      complete: agreement('circles', {
        algorithm: 'hierarchical',
        linkage: 'complete',
      }),
      average: agreement('circles', {
        algorithm: 'hierarchical',
        linkage: 'average',
      }),
    };
    // 单连接顺着环一路串下去；另外两种和 K-means 一样偏爱紧凑的球
    expect(scores.single).toBeGreaterThan(0.95);
    expect(scores.complete).toBeLessThan(0.3);
    expect(scores.average).toBeLessThan(0.3);
  });

  it('数据本来没有结构时，三个算法照样给出划分', () => {
    for (const algorithm of ALGORITHMS) {
      const { run } = solve('uniform', { algorithm });
      const stats = run.stats();
      // 分是分了，而且分得挺整齐 —— 只是这个划分毫无意义
      expect(stats.clusters, algorithm).toBeGreaterThan(0);
      expect(Math.abs(stats.agreement), algorithm).toBeLessThan(0.1);
    }
  });
});

describe('K-means', () => {
  /** 同一份数据，只换初始中心的种子 */
  function initScores(smartInit: boolean) {
    const config = configFor('blobs', { algorithm: 'kmeans', smartInit });
    const data = buildDataset('blobs', config.pointCount, config.seed);
    return [1, 2, 3, 4, 5, 6, 7, 8].map(initSeed => {
      const run = createRun(data, { ...config, initSeed });
      run.runToEnd();
      return run.stats().agreement;
    });
  }

  it('初始中心挑不好就收敛到局部最优，而且它毫无察觉', () => {
    const scores = initScores(false);
    // 同一份数据、同一个算法，只换初始中心，结果就掉下来了 ——
    // 而且它照样报告"已收敛"，不会有任何异常
    expect(Math.min(...scores)).toBeLessThan(0.7);
    expect(Math.max(...scores)).toBeGreaterThan(0.95);
  });

  it('K-means++ 把这个坑填掉了大半', () => {
    const smart = initScores(true);
    const plain = initScores(false);
    expect(Math.min(...smart)).toBeGreaterThan(Math.min(...plain));
    expect(Math.min(...smart)).toBeGreaterThan(0.9);
  });

  it('收敛之后再走一步，什么都不会变', () => {
    const { run } = solve('blobs', { algorithm: 'kmeans' });
    expect(run.done).toBe(true);
    const before = [...run.labels];
    run.step();
    expect([...run.labels]).toEqual(before);
  });

  it('每个点最终都归到离它最近的那个中心', () => {
    const { run } = solve('blobs', { algorithm: 'kmeans' });
    const kmeans = run as KMeansRun;
    for (let point = 0; point < kmeans.count; point++) {
      let best = 0;
      let bestDist = Infinity;
      for (let center = 0; center < kmeans.k; center++) {
        const dx = kmeans.data.points[point * 2] - kmeans.centers[center * 2];
        const dy =
          kmeans.data.points[point * 2 + 1] - kmeans.centers[center * 2 + 1];
        const value = dx * dx + dy * dy;
        if (value < bestDist - 1e-12) {
          bestDist = value;
          best = center;
        }
      }
      expect(kmeans.labels[point], `点 ${point}`).toBe(best);
    }
  });
});

describe('DBSCAN', () => {
  it('核心点、边界点、噪声的定义都对得上', () => {
    const { run, data, config } = solve('blobs', { algorithm: 'dbscan' });
    const dbscan = run as DbscanRun;

    for (let point = 0; point < dbscan.count; point++) {
      const neighbours = countWithin(data, point, config.eps);
      // 核心点：邻居数达标
      expect(dbscan.core[point] === 1, `点 ${point}`).toBe(
        neighbours >= config.minPts
      );
      // 每个点都被访问过 —— 扫描是完整的
      expect(dbscan.visited[point], `点 ${point}`).toBe(1);
      // 噪声点自己不稠密（否则它早该开一个簇）
      if (dbscan.labels[point] < 0) {
        expect(neighbours, `噪声点 ${point}`).toBeLessThan(config.minPts);
      }
    }
    expect(dbscan.stats().pending).toBe(0);
  });

  it('eps 一大簇就并成一片，一小就碎成渣', () => {
    const tight = solve('moons', { algorithm: 'dbscan', eps: 0.03 });
    const good = solve('moons', { algorithm: 'dbscan', eps: 0.06 });
    const loose = solve('moons', { algorithm: 'dbscan', eps: 0.14 });

    expect(tight.run.stats().clusters).toBeGreaterThan(2);
    expect(tight.run.stats().noise).toBeGreaterThan(0);
    expect(good.run.stats().clusters).toBe(2);
    // 两个月牙被当成同一片稠密区域
    expect(loose.run.stats().clusters).toBe(1);
    expect(loose.run.stats().agreement).toBeLessThan(0.1);
  });

  it('簇数是数据说了算的，不用事先指定', () => {
    // k 给成什么都不影响 DBSCAN 的结果
    const three = solve('blobs', { algorithm: 'dbscan', k: 3 });
    const seven = solve('blobs', { algorithm: 'dbscan', k: 7 });
    expect([...seven.run.labels]).toEqual([...three.run.labels]);
  });
});

describe('层次聚类', () => {
  it('一路合并到正好 K 个簇', () => {
    for (const k of [2, 4, 6]) {
      const { run } = solve('blobs', { algorithm: 'hierarchical', k });
      expect(clusterCount(run.labels), `k=${k}`).toBe(k);
      expect(run.stats().clusters).toBe(k);
    }
  });

  it('合并的距离一路不降 —— 每次挑的都是当下最近的一对', () => {
    const { run } = solve('blobs', { algorithm: 'hierarchical', k: 3 });
    const merges = (run as HierarchicalRun).merges;
    expect(merges.length).toBeGreaterThan(10);
    // 单连接下这个序列是单调的，也就是树状图的高度只增不减
    for (let i = 1; i < merges.length; i++) {
      expect(merges[i].distance).toBeGreaterThanOrEqual(
        merges[i - 1].distance - 1e-9
      );
    }
  });

  it('每个点都有归属，没有噪声这一说', () => {
    const { run } = solve('moons', { algorithm: 'hierarchical' });
    expect(run.stats().noise).toBe(0);
    expect([...run.labels].every(label => label >= 0)).toBe(true);
  });
});

describe('内核的公共约定', () => {
  it('单步累加起来和一口气跑到底是同一个结果', () => {
    for (const kind of ['blobs', 'moons'] as const) {
      for (const algorithm of ALGORITHMS) {
        const config = configFor(kind, { algorithm });
        const data = buildDataset(kind, config.pointCount, config.seed);

        const stepwise = createRun(data, config);
        let guard = 0;
        while (!stepwise.step() && guard++ < 200000);
        const batch = createRun(data, config);
        batch.runToEnd();

        expect([...stepwise.labels], `${kind}/${algorithm}`).toEqual([
          ...batch.labels,
        ]);
        expect(stepwise.stats().steps, `${kind}/${algorithm}`).toBe(
          batch.stats().steps
        );
      }
    }
  });

  it('都会停下来，而且步数在可播放的范围内', () => {
    for (const kind of Object.keys(datasetLabels) as DatasetKind[]) {
      for (const algorithm of ALGORITHMS) {
        const { run } = solve(kind, { algorithm });
        expect(run.done, `${kind}/${algorithm}`).toBe(true);
        expect(run.stats().steps, `${kind}/${algorithm}`).toBeLessThan(6000);
      }
    }
  });

  it('工厂造出来的是对得上的那个内核', () => {
    const data = buildDataset('blobs', 60, 1);
    expect(
      createRun(data, configFor('blobs', { algorithm: 'kmeans' }))
    ).toBeInstanceOf(KMeansRun);
    expect(
      createRun(data, configFor('blobs', { algorithm: 'dbscan' }))
    ).toBeInstanceOf(DbscanRun);
    expect(
      createRun(data, configFor('blobs', { algorithm: 'hierarchical' }))
    ).toBeInstanceOf(HierarchicalRun);
    expect(createRun(data, configFor('blobs'))).toBeInstanceOf(ClusterRun);
  });

  it('k 比点数还大也不会炸', () => {
    const data = buildDataset('blobs', 6, 1);
    for (const algorithm of ALGORITHMS) {
      const run = createRun(data, configFor('blobs', { algorithm, k: 20 }));
      run.runToEnd();
      expect(run.done, algorithm).toBe(true);
    }
  });
});

describe('调整兰德指数', () => {
  it('完全一致是 1，换个编号也还是 1', () => {
    const truth = Int32Array.from([0, 0, 1, 1, 2, 2]);
    expect(adjustedRandIndex(truth, truth)).toBeCloseTo(1);
    // 簇号只是编号，对调之后是同一个划分
    expect(
      adjustedRandIndex(truth, Int32Array.from([2, 2, 0, 0, 1, 1]))
    ).toBeCloseTo(1);
  });

  it('全塞进一个簇，得分是 0 而不是「一半对」', () => {
    const truth = Int32Array.from([0, 0, 0, 1, 1, 1]);
    expect(adjustedRandIndex(truth, new Int32Array(6))).toBeCloseTo(0);
  });

  it('把该在一起的拆散，会掉到 0 以下', () => {
    const truth = Int32Array.from([0, 0, 0, 0, 1, 1, 1, 1]);
    const crossed = Int32Array.from([0, 1, 0, 1, 0, 1, 0, 1]);
    expect(adjustedRandIndex(truth, crossed)).toBeLessThan(0);
  });

  it('噪声点各算各的，判成噪声要付出代价', () => {
    const truth = Int32Array.from([0, 0, 0, 1, 1, 1]);
    const perfect = adjustedRandIndex(
      truth,
      Int32Array.from([0, 0, 0, 1, 1, 1])
    );
    const withNoise = adjustedRandIndex(
      truth,
      Int32Array.from([0, 0, -1, 1, 1, -1])
    );
    expect(perfect).toBeCloseTo(1);
    expect(withNoise).toBeLessThan(perfect);
  });
});

/** eps 半径内有几个点（含自己） */
function countWithin(data: Dataset, point: number, eps: number) {
  let count = 0;
  for (let other = 0; other < data.truth.length; other++) {
    if (distance(data, point, other) <= eps) count++;
  }
  return count;
}
