import type { Distribution } from './data';
import type { SortAlgorithm } from './sorter';

/** 元素个数。默认给得偏小，是为了单步时一眼能看清每根柱子 */
export const DEFAULT_SIZE = 64;
export const MIN_SIZE = 16;
export const MAX_SIZE = 240;

/**
 * 每帧执行多少步。O(n²) 的三种在 n=240 时要跑几万步，
 * 上限给得比迷宫那页高一个档，不然看完一遍冒泡要等太久。
 */
export const DEFAULT_SPEED = 16;
export const MAX_SPEED = 400;

/** 对比模式下并排跑的六种算法，按「平方级三种 / 线性对数三种」分两行 */
export const comparedAlgorithms: SortAlgorithm[] = [
  'bubble',
  'insertion',
  'selection',
  'merge',
  'quick',
  'heap',
];

export const algorithmLabels: Record<
  SortAlgorithm,
  {
    label: string;
    /** 按钮和表格里用的短名 —— 面板只有一半宽，放不下全称 */
    short: string;
    enName: string;
    /** 平均复杂度，画在标题栏上 */
    complexity: string;
    blurb: string;
  }
> = {
  bubble: {
    label: '冒泡排序',
    short: '冒泡',
    enName: 'Bubble Sort',
    complexity: 'O(n²)',
    blurb:
      '相邻两两比、大的往后挪，每趟把一个最大值顶到尾巴。带提前退出，所以近乎有序的输入一趟就停。',
  },
  insertion: {
    label: '插入排序',
    short: '插入',
    enName: 'Insertion Sort',
    complexity: 'O(n²)',
    blurb:
      '左边是一段有序区，把下一个值提起来往里插。腾位置是写不是换，同样的乱序度下写入只有冒泡的一半。',
  },
  selection: {
    label: '选择排序',
    short: '选择',
    enName: 'Selection Sort',
    complexity: 'O(n²)',
    blurb:
      '每趟扫全场找最小，再和区首换一次。比较次数雷打不动 n(n-1)/2，但写入只有 2(n-1) —— 六种里最省写入的。',
  },
  merge: {
    label: '归并排序',
    short: '归并',
    enName: 'Merge Sort',
    complexity: 'O(n log n)',
    blurb:
      '左右各自排好，再合成一段。稳定、最坏也不退化，代价是要一块和原数组一样大的辅助空间。',
  },
  quick: {
    label: '快速排序',
    short: '快排',
    enName: 'Quicksort',
    complexity: 'O(n log n)',
    blurb:
      '挑一个轴，小的甩左边、大的甩右边，两侧再各来一遍。这里故意取末元素当轴 —— 有序输入会让它当场退化。',
  },
  heap: {
    label: '堆排序',
    short: '堆排',
    enName: 'Heapsort',
    complexity: 'O(n log n)',
    blurb:
      '先把数组整理成大顶堆，再反复把堆顶换到末尾、堆缩一格。原地且最坏有保证，但跳着访存，常数比快排大。',
  },
};

export const distributionLabels: Record<
  Distribution,
  { label: string; blurb: string }
> = {
  random: { label: '随机', blurb: '完全打乱，各算法的教科书基准情形。' },
  nearly: {
    label: '近乎有序',
    blurb: '只有零星几处错位。插入和冒泡在这里接近 O(n)，快排却开始变慢。',
  },
  reversed: {
    label: '逆序',
    blurb: '最坏情形：冒泡与插入的比较、写入都拉满，天真取轴的快排也退化。',
  },
  few: {
    label: '少量重复值',
    blurb: '只有五种高度。等值元素一多，Lomuto 划分就切不匀了。',
  },
};

// ─── 绘制 ─────────────────────────────────────────────────────
export const sortColors = {
  background: '#181c24',
  /** 还没被处理到的元素 */
  bar: '#4a5670',
  /** 当前正在处理的区间：快排的子区间 / 归并的合并段 / 堆排的堆区 */
  range: '#6d7c9c',
  /** 这一步比较或写入碰到的位置 */
  active: '#5ad1c8',
  /** 被单独盯住的那个：快排的轴 / 选择排序当前的最小值 / 堆排正在下沉的根 */
  focus: '#e8a33d',
  /** 已经落在最终位置上 */
  done: '#4bb98a',
} as const;
