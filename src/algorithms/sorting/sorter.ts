/**
 * 六种比较排序，全部写成可单步执行的形式。
 *
 * 和迷宫生成那边一样，单步是为了做动画；但这里还有第二个理由 ——
 * 排序算法的差别不在结果（结果都是同一个有序数组），而在**它们付出了什么**：
 * 比较了多少次、往数组里写了多少次、以及这些动作落在哪些位置上。
 * 把每一次比较、每一次写入都停一帧，这三样才看得见。
 *
 * 实现用 generator：`yield` 一次就是一步，算法本体因此和教科书伪代码
 * 几乎逐行对应 —— 没有手写状态机那种为了能中断而拆出来的一堆字段。
 * 计数、高亮、写数组这些副作用统一收在 `Sorter` 的几个原语里
 * （`cmp` / `swap` / `write`），算法函数只管调用。
 */
export type SortAlgorithm =
  'bubble' | 'insertion' | 'selection' | 'merge' | 'quick' | 'heap';

/** 每个下标此刻的角色，用来着色 */
export const MARK_NONE = 0;
/** 当前正在处理的区间：快排的子区间、归并的合并段、堆排的堆区 */
export const MARK_RANGE = 1;
/** 已经落在最终位置上，之后不会再动 */
export const MARK_DONE = 2;

export interface SortStats {
  /** 比较次数 */
  comparisons: number;
  /** 写入次数，一次交换算两次 */
  writes: number;
  /** 执行过的步数 —— 一次比较或一次搬动算一步（交换是一步、两次写入） */
  steps: number;
  done: boolean;
}

/** 一段可中断的过程：yield 一次 = 一步，T 是它跑完之后交回的东西 */
type Trace<T = void> = Generator<void, T, void>;
/** 比较原语交回的是差值 */
type Compare = Trace<number>;

export class Sorter {
  readonly values: Int32Array;
  /** 归并用的辅助数组。下标和主数组一一对应，高亮才能直接复用下标 */
  readonly aux: Int32Array;
  readonly mark: Uint8Array;
  readonly n: number;

  /** 这一步碰的两个下标，-1 表示没有 */
  a = -1;
  b = -1;
  /**
   * 被单独盯住的那个下标：快排的轴、选择排序当前的最小值、
   * 堆排正在下沉的根。-1 表示没有。
   */
  focus = -1;

  comparisons = 0;
  writes = 0;
  steps = 0;

  private readonly trace: Trace;
  private finished = false;

  constructor(algorithm: SortAlgorithm, values: Int32Array) {
    // 原地排序：调用方给的就是要被改的那份
    this.values = values;
    this.n = values.length;
    this.aux = new Int32Array(this.n);
    this.mark = new Uint8Array(this.n);
    this.trace = traces[algorithm](this);
  }

  get done() {
    return this.finished;
  }

  /** 执行一步，返回是否真的走了一步 */
  step(): boolean {
    if (this.finished) return false;
    if (this.trace.next().done) this.finish();
    return true;
  }

  advance(steps: number): number {
    let taken = 0;
    while (taken < steps && !this.finished) {
      this.step();
      taken++;
    }
    return taken;
  }

  /** limit 纯粹是防死循环：n=256 的冒泡也才十万步上下 */
  runToEnd(limit = 8_000_000) {
    let guard = 0;
    while (!this.finished && guard++ < limit) this.step();
  }

  stats(): SortStats {
    return {
      comparisons: this.comparisons,
      writes: this.writes,
      steps: this.steps,
      done: this.finished,
    };
  }

  // ─── 给算法函数用的原语 ──────────────────────────────────────
  // 每个原语恰好 yield 一次，所以「步」的口径在六个算法之间是统一的：
  // 一次比较或一次搬动算一步。计数和高亮都在这里落，算法本体不碰。

  /** 比较主数组的两个位置，返回 values[i] - values[j] */
  *cmp(i: number, j: number): Compare {
    const diff = this.values[i] - this.values[j];
    this.comparisons++;
    this.steps++;
    this.a = i;
    this.b = j;
    yield;
    return diff;
  }

  /** 比较辅助数组的两个位置 —— 归并时两边的候选都还在 aux 里 */
  *cmpAux(i: number, j: number): Compare {
    const diff = this.aux[i] - this.aux[j];
    this.comparisons++;
    this.steps++;
    this.a = i;
    this.b = j;
    yield;
    return diff;
  }

  /**
   * 拿位置 i 和一个「提在手上」的值比。插入排序腾位置时，
   * 待插入的那个值已经不在数组里了，hold 是它原来的位置。
   */
  *cmpValue(i: number, value: number, hold: number): Compare {
    const diff = this.values[i] - value;
    this.comparisons++;
    this.steps++;
    this.a = i;
    this.b = hold;
    yield;
    return diff;
  }

  *swap(i: number, j: number): Trace {
    const temp = this.values[i];
    this.values[i] = this.values[j];
    this.values[j] = temp;
    this.writes += 2;
    this.steps++;
    this.a = i;
    this.b = j;
    yield;
  }

  *write(i: number, value: number): Trace {
    this.values[i] = value;
    this.writes++;
    this.steps++;
    this.a = i;
    this.b = -1;
    yield;
  }

  /** 改区间标记不算一步：它只是给画面分层，不是算法做的功 */
  markRange(lo: number, hi: number, value: number) {
    this.mark.fill(value, lo, hi + 1);
  }

  private finish() {
    this.finished = true;
    this.mark.fill(MARK_DONE);
    this.a = -1;
    this.b = -1;
    this.focus = -1;
  }
}

export function createSorter(algorithm: SortAlgorithm, values: Int32Array) {
  return new Sorter(algorithm, values);
}

// ─── 六种排序 ─────────────────────────────────────────────────

/**
 * 冒泡：相邻两两比，大的往后挪。带提前退出 ——
 * 一整趟下来没换过位置就说明已经有序，近乎有序的输入靠这一句变成 O(n)。
 */
function* bubble(s: Sorter): Trace {
  for (let end = s.n - 1; end > 0; end--) {
    let swapped = false;
    for (let i = 0; i < end; i++) {
      if ((yield* s.cmp(i, i + 1)) > 0) {
        yield* s.swap(i, i + 1);
        swapped = true;
      }
    }
    // 这一趟的最大值已经冒到 end，不会再动
    s.mark[end] = MARK_DONE;
    if (!swapped) return;
  }
}

/**
 * 插入：左边始终是一段有序区，把下一个值提起来，在有序区里
 * 从右往左边比边腾位置。注意腾位置是 write 不是 swap ——
 * 每挪一格只写一次，这是它比冒泡省一半写入的地方。
 */
function* insertion(s: Sorter): Trace {
  s.mark[0] = MARK_RANGE;
  for (let i = 1; i < s.n; i++) {
    const value = s.values[i];
    s.mark[i] = MARK_RANGE;
    let j = i - 1;
    while (j >= 0 && (yield* s.cmpValue(j, value, i)) > 0) {
      yield* s.write(j + 1, s.values[j]);
      j--;
    }
    if (j + 1 !== i) yield* s.write(j + 1, value);
  }
}

/**
 * 选择：每一趟扫完整个未排序区找出最小值，和区首交换一次。
 * 比较次数固定是 n(n-1)/2，什么输入都一样；但写入只有 2(n-1) 次 ——
 * 六种里最省写入的，值搬起来很贵时（大结构体）这一点才有意义。
 */
function* selection(s: Sorter): Trace {
  for (let i = 0; i < s.n - 1; i++) {
    let min = i;
    s.focus = min;
    for (let j = i + 1; j < s.n; j++) {
      if ((yield* s.cmp(j, min)) < 0) {
        min = j;
        s.focus = min;
      }
    }
    if (min !== i) yield* s.swap(i, min);
    s.mark[i] = MARK_DONE;
  }
  s.focus = -1;
}

/** 归并：先各自排好左右两半，再把两段有序的合成一段 */
function* merge(s: Sorter): Trace {
  yield* mergeRange(s, 0, s.n - 1);
}

function* mergeRange(s: Sorter, lo: number, hi: number): Trace {
  if (lo >= hi) return;
  const mid = (lo + hi) >> 1;
  yield* mergeRange(s, lo, mid);
  yield* mergeRange(s, mid + 1, hi);
  yield* mergeTwo(s, lo, mid, hi);
}

/**
 * 合并两段有序区。先整段拷进 aux，再从 aux 挑小的写回主数组 ——
 * 画面上因此看得到「一段区间被整体重写」，那就是归并花掉的额外空间。
 * 相等时取左边，这是归并稳定的唯一理由。
 */
function* mergeTwo(s: Sorter, lo: number, mid: number, hi: number): Trace {
  s.markRange(lo, hi, MARK_RANGE);
  for (let k = lo; k <= hi; k++) s.aux[k] = s.values[k];

  let i = lo;
  let j = mid + 1;
  for (let k = lo; k <= hi; k++) {
    if (i > mid) yield* s.write(k, s.aux[j++]);
    else if (j > hi) yield* s.write(k, s.aux[i++]);
    else if ((yield* s.cmpAux(j, i)) < 0) yield* s.write(k, s.aux[j++]);
    else yield* s.write(k, s.aux[i++]);
  }
  s.markRange(lo, hi, MARK_NONE);
}

/** 快排：选一个轴，把小的都甩到它左边，然后左右各自再来一遍 */
function* quick(s: Sorter): Trace {
  yield* quickRange(s, 0, s.n - 1);
}

function* quickRange(s: Sorter, lo: number, hi: number): Trace {
  if (lo > hi) return;
  if (lo === hi) {
    s.mark[lo] = MARK_DONE;
    return;
  }
  s.markRange(lo, hi, MARK_RANGE);
  const p = yield* partition(s, lo, hi);
  s.markRange(lo, hi, MARK_NONE);
  // 轴归位之后就定稿了 —— 这是快排唯一"确定"下来的东西
  s.mark[p] = MARK_DONE;
  yield* quickRange(s, lo, p - 1);
  yield* quickRange(s, p + 1, hi);
}

/**
 * Lomuto 划分，轴固定取末元素。
 *
 * 故意不做三数取中：正因为轴取得这么天真，已排序和逆序输入会让它
 * 每次只切掉一个元素，直接退化成 O(n²)。这一页想让人看见的就是
 * 「快排快不快，全看轴挑得好不好」—— 换成三数取中就看不见了。
 */
function* partition(s: Sorter, lo: number, hi: number): Trace<number> {
  s.focus = hi;
  let store = lo;
  for (let i = lo; i < hi; i++) {
    if ((yield* s.cmp(i, hi)) < 0) {
      if (i !== store) yield* s.swap(i, store);
      store++;
    }
  }
  if (store !== hi) yield* s.swap(store, hi);
  s.focus = -1;
  return store;
}

/**
 * 堆排：先把整个数组整理成大顶堆（自底向上建堆，O(n)），
 * 然后反复把堆顶换到末尾、堆缩小一格、重新下沉。
 * 原地、最坏也是 O(n log n) —— 但每次下沉都在数组里跳着走，
 * 缓存命中率差，实测常常跑不过快排。
 */
function* heap(s: Sorter): Trace {
  const n = s.n;
  if (n < 2) return;
  s.markRange(0, n - 1, MARK_RANGE);

  for (let root = (n >> 1) - 1; root >= 0; root--) {
    yield* siftDown(s, root, n);
  }
  for (let end = n - 1; end > 0; end--) {
    yield* s.swap(0, end);
    s.mark[end] = MARK_DONE;
    yield* siftDown(s, 0, end);
  }
  s.focus = -1;
}

/** 把 root 处的值一路往下换，直到它比两个孩子都大 */
function* siftDown(s: Sorter, root: number, end: number): Trace {
  while (true) {
    const left = root * 2 + 1;
    if (left >= end) break;
    s.focus = root;
    let child = left;
    const right = left + 1;
    if (right < end && (yield* s.cmp(right, left)) > 0) child = right;
    if ((yield* s.cmp(child, root)) <= 0) break;
    yield* s.swap(root, child);
    root = child;
  }
}

const traces: Record<SortAlgorithm, (s: Sorter) => Trace> = {
  bubble,
  insertion,
  selection,
  merge,
  quick,
  heap,
};
