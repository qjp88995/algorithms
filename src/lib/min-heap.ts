/**
 * 二叉最小堆，元素是整数下标（节点号 / 边号）。
 *
 * key 相同时按入堆序号先进先出。这个 tie-break 不是可有可无的细节：
 * 网格寻路里 BFS 就是靠"key 恒等于入堆序号"把这个堆当成 FIFO 队列用的，
 * 少了它 BFS 就得单独写一份队列。
 *
 * 不做 decrease-key。距离变小时直接重复入堆，弹出时由调用方
 * 用自己的 dist / state 数组判断是不是过期条目（惰性删除）。
 * 在这些演示的规模下，这比维护"节点 → 堆位置"的索引更简单也更快。
 */
export class MinHeap {
  private keys: number[] = [];
  private seqs: number[] = [];
  private items: number[] = [];

  get size() {
    return this.items.length;
  }

  push(key: number, seq: number, item: number) {
    this.keys.push(key);
    this.seqs.push(seq);
    this.items.push(item);
    this.bubbleUp(this.items.length - 1);
  }

  pop(): number {
    const item = this.items[0];
    const last = this.items.length - 1;
    if (last > 0) {
      this.swap(0, last);
    }
    this.keys.pop();
    this.seqs.pop();
    this.items.pop();
    if (this.items.length > 0) this.sinkDown(0);
    return item;
  }

  private less(a: number, b: number) {
    if (this.keys[a] !== this.keys[b]) return this.keys[a] < this.keys[b];
    return this.seqs[a] < this.seqs[b];
  }

  private swap(a: number, b: number) {
    [this.keys[a], this.keys[b]] = [this.keys[b], this.keys[a]];
    [this.seqs[a], this.seqs[b]] = [this.seqs[b], this.seqs[a]];
    [this.items[a], this.items[b]] = [this.items[b], this.items[a]];
  }

  private bubbleUp(index: number) {
    while (index > 0) {
      const parent = (index - 1) >> 1;
      if (!this.less(index, parent)) break;
      this.swap(index, parent);
      index = parent;
    }
  }

  private sinkDown(index: number) {
    const length = this.items.length;
    for (;;) {
      const left = index * 2 + 1;
      const right = left + 1;
      let smallest = index;
      if (left < length && this.less(left, smallest)) smallest = left;
      if (right < length && this.less(right, smallest)) smallest = right;
      if (smallest === index) break;
      this.swap(index, smallest);
      index = smallest;
    }
  }
}
