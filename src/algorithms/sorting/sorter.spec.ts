import { describe, expect, it } from 'vitest';

import { type Distribution, FEW_LEVELS, makeValues } from './data';
import {
  createSorter,
  MARK_DONE,
  type SortAlgorithm,
  type Sorter,
} from './sorter';

const algorithms: SortAlgorithm[] = [
  'bubble',
  'insertion',
  'selection',
  'merge',
  'quick',
  'heap',
];

const distributions: Distribution[] = ['random', 'nearly', 'reversed', 'few'];

function sorted(values: Int32Array) {
  return Int32Array.from(values).sort();
}

function run(
  algorithm: SortAlgorithm,
  values: Int32Array,
  step = false
): Sorter {
  const sorter = createSorter(algorithm, Int32Array.from(values));
  if (step) {
    let guard = 0;
    while (sorter.step() && guard++ < 4_000_000);
  } else {
    sorter.runToEnd();
  }
  return sorter;
}

function ascending(n: number) {
  const values = new Int32Array(n);
  for (let i = 0; i < n; i++) values[i] = i + 1;
  return values;
}

describe('数据分布', () => {
  it('同一组参数永远给出同一个数组', () => {
    for (const distribution of distributions) {
      expect(makeValues(48, distribution, 7)).toEqual(
        makeValues(48, distribution, 7)
      );
    }
  });

  it('除少量重复值外都是 1..n 的排列', () => {
    for (const distribution of ['random', 'nearly', 'reversed'] as const) {
      const values = makeValues(40, distribution, 3);
      expect(sorted(values), distribution).toEqual(ascending(40));
    }
  });

  it('少量重复值只有五种高度', () => {
    const values = makeValues(120, 'few', 5);
    expect(new Set(values).size).toBeLessThanOrEqual(FEW_LEVELS);
  });

  it('近乎有序确实近乎有序：错位处远少于元素个数', () => {
    const values = makeValues(120, 'nearly', 2);
    let descents = 0;
    for (let i = 0; i + 1 < values.length; i++) {
      if (values[i] > values[i + 1]) descents++;
    }
    expect(descents).toBeGreaterThan(0);
    expect(descents).toBeLessThan(values.length / 4);
  });
});

describe('六种排序都排得对', () => {
  for (const algorithm of algorithms) {
    for (const distribution of distributions) {
      it(`${algorithm} · ${distribution}`, () => {
        const input = makeValues(97, distribution, 11);
        const sorter = run(algorithm, input);
        expect(sorter.done).toBe(true);
        // 排序结果既要有序，也要是原数组的一个排列（不能凭空造值）
        expect(sorter.values).toEqual(sorted(input));
      });
    }
  }

  it('长度 0 和 1 也能收敛', () => {
    for (const algorithm of algorithms) {
      for (const n of [0, 1]) {
        const sorter = run(algorithm, ascending(n));
        expect(sorter.done, `${algorithm} n=${n}`).toBe(true);
      }
    }
  });
});

describe('单步与直接跑到底等价', () => {
  for (const algorithm of algorithms) {
    it(algorithm, () => {
      const input = makeValues(61, 'random', 23);
      const stepped = run(algorithm, input, true);
      const straight = run(algorithm, input);
      expect(stepped.values).toEqual(straight.values);
      expect(stepped.stats()).toEqual(straight.stats());
    });
  }

  it('advance 只走到结束为止，之后返回 0', () => {
    const sorter = createSorter('insertion', makeValues(32, 'random', 4));
    const taken = sorter.advance(10_000_000);
    expect(sorter.done).toBe(true);
    expect(taken).toBeLessThan(10_000_000);
    expect(sorter.advance(10)).toBe(0);
    expect(sorter.step()).toBe(false);
  });
});

describe('收尾状态', () => {
  it('跑完之后全部标为已定稿，高亮全部撤掉', () => {
    for (const algorithm of algorithms) {
      const sorter = run(algorithm, makeValues(40, 'random', 9));
      expect(
        sorter.mark.every(value => value === MARK_DONE),
        algorithm
      ).toBe(true);
      expect([sorter.a, sorter.b, sorter.focus], algorithm).toEqual([
        -1, -1, -1,
      ]);
    }
  });

  // 口径：一次比较或一次搬动算一步，而一次交换是一步、两次写入
  it('步数减去比较次数就是搬动次数，写入落在它的一到两倍之间', () => {
    for (const algorithm of algorithms) {
      const { comparisons, writes, steps } = run(
        algorithm,
        makeValues(53, 'random', 6)
      ).stats();
      const moves = steps - comparisons;
      expect(moves, algorithm).toBeGreaterThan(0);
      expect(writes, algorithm).toBeGreaterThanOrEqual(moves);
      expect(writes, algorithm).toBeLessThanOrEqual(2 * moves);
    }
  });
});

describe('代价的差别 —— 这一页真正要看的东西', () => {
  const n = 64;

  it('选择排序的比较次数与输入无关，写入却是六种里最少的', () => {
    const counts = distributions.map(
      distribution =>
        run('selection', makeValues(n, distribution, 8)).stats().comparisons
    );
    expect(new Set(counts).size).toBe(1);
    expect(counts[0]).toBe((n * (n - 1)) / 2);

    const writes = run('selection', makeValues(n, 'random', 8)).stats().writes;
    expect(writes).toBeLessThanOrEqual(2 * (n - 1));
    expect(writes).toBeLessThan(
      run('bubble', makeValues(n, 'random', 8)).stats().writes
    );
  });

  it('已经有序时，冒泡与插入一趟就停', () => {
    for (const algorithm of ['bubble', 'insertion'] as const) {
      const { comparisons, writes } = run(algorithm, ascending(n)).stats();
      expect(comparisons, algorithm).toBe(n - 1);
      expect(writes, algorithm).toBe(0);
    }
  });

  it('同样的乱序度下，插入的写入少于冒泡', () => {
    const input = makeValues(n, 'random', 15);
    expect(run('insertion', input).stats().writes).toBeLessThan(
      run('bubble', input).stats().writes
    );
  });

  it('归并的写入次数与输入分布无关', () => {
    const counts = distributions.map(
      distribution =>
        run('merge', makeValues(n, distribution, 12)).stats().writes
    );
    expect(new Set(counts).size).toBe(1);
  });

  it('末元素取轴的快排在有序输入上退化成平方级', () => {
    const degraded = run('quick', ascending(n)).stats().comparisons;
    expect(degraded).toBe((n * (n - 1)) / 2);
    // 随机输入下该是 n log n 量级，差着一个数量级
    expect(
      run('quick', makeValues(n, 'random', 21)).stats().comparisons
    ).toBeLessThan(degraded / 3);
  });

  it('归并与堆排不会因为输入变坏而退化', () => {
    for (const algorithm of ['merge', 'heap'] as const) {
      const counts = distributions.map(
        distribution =>
          run(algorithm, makeValues(n, distribution, 17)).stats().comparisons
      );
      const worst = Math.max(...counts);
      const best = Math.min(...counts);
      // 归并在一边先耗尽时能整段跳过比较，所以分布仍有影响 ——
      // 但只是常数级的，和平方级退化不是一回事
      expect(worst / best, algorithm).toBeLessThan(2.5);
      // n log n 的常数因子放宽到 4 倍，够松也够挡住平方级
      expect(worst, algorithm).toBeLessThan(4 * n * Math.log2(n));
    }
  });
});
