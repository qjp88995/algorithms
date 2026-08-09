import { seededRandom } from '@/lib/random';

/**
 * 待排数组的四种分布。
 *
 * 「排序算法的复杂度」写在纸上是一个式子，但那个式子对不同输入根本不是
 * 同一件事：插入排序在近乎有序上是 O(n)，冒泡靠提前退出也是；
 * 而天真取轴的快排在**已经有序**的输入上反而退化成 O(n²)。
 * 分布是这一页的第二根轴 —— 换算法之外，换输入同样能改变结论。
 */
export type Distribution = 'random' | 'nearly' | 'reversed' | 'few';

/** 少量唯一值时的档位数：重复元素多到什么程度才够看出问题 */
export const FEW_LEVELS = 5;

/**
 * 生成待排数组。值域固定是 1..n，柱子的高度因此可以直接按 n 归一化，
 * 换尺寸时画面不会突然变矮。
 *
 * 同一个 (n, distribution, seed) 永远给出同一个数组 —— 对比模式下
 * 六个算法各自建一份，靠的就是这个确定性，比较的才是算法不是运气。
 */
export function makeValues(
  n: number,
  distribution: Distribution,
  seed: number
): Int32Array {
  const random = seededRandom(seed);
  const values = new Int32Array(n);

  if (distribution === 'few') {
    // 只有 FEW_LEVELS 种高度，于是大量元素两两相等
    const stride = Math.max(1, Math.floor(n / FEW_LEVELS));
    for (let i = 0; i < n; i++) {
      values[i] = (1 + Math.floor(random() * FEW_LEVELS)) * stride;
    }
    return values;
  }

  for (let i = 0; i < n; i++) values[i] = i + 1;

  if (distribution === 'reversed') {
    values.reverse();
    return values;
  }

  if (distribution === 'nearly') {
    // 只打乱很少几对，而且只在近距离内换：整体保持升序，
    // 但逆序对不为零 —— 提前退出的冒泡仍要多跑几趟才停
    const swaps = Math.max(1, Math.round(n / 12));
    for (let k = 0; k < swaps; k++) {
      const i = Math.floor(random() * (n - 1));
      const j = Math.min(n - 1, i + 1 + Math.floor(random() * 4));
      const temp = values[i];
      values[i] = values[j];
      values[j] = temp;
    }
    return values;
  }

  // random：Fisher-Yates 全打乱
  for (let i = n - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    const temp = values[i];
    values[i] = values[j];
    values[j] = temp;
  }
  return values;
}
