/**
 * 并查集（路径压缩 + 按秩合并）。
 *
 * 元素是 0…size-1 的整数下标。两个操作：问「这两个在不在一起」，
 * 以及「把它们并起来」—— 恰好就是 Kruskal 和 Borůvka 每一步要做的
 * 判断：这条边接上会不会成环。
 *
 * `union` 返回是否真的合并了。调用方几乎总要区分这两种情况
 * （合并了就收下这条边，没合并说明成环要丢掉），让它自己再
 * `find` 一次比较是多余的。
 */
export class DisjointSet {
  private readonly parent: Int32Array;
  /** 树高的上界。按秩合并把树压得很矮，秩不会超过 log₂(size) */
  private readonly rank: Uint8Array;
  private groups: number;

  constructor(size: number) {
    this.parent = new Int32Array(size);
    for (let i = 0; i < size; i++) this.parent[i] = i;
    this.rank = new Uint8Array(size);
    this.groups = size;
  }

  /** 当前还有几个互不相连的集合 */
  get count() {
    return this.groups;
  }

  find(x: number): number {
    let node = x;
    while (this.parent[node] !== node) {
      // 路径压缩：顺手把这条链挂到祖父上，树就越走越扁
      this.parent[node] = this.parent[this.parent[node]];
      node = this.parent[node];
    }
    return node;
  }

  connected(a: number, b: number) {
    return this.find(a) === this.find(b);
  }

  /** 合并 a、b 所在集合；本来就在一起则返回 false */
  union(a: number, b: number): boolean {
    const rootA = this.find(a);
    const rootB = this.find(b);
    if (rootA === rootB) return false;

    if (this.rank[rootA] < this.rank[rootB]) {
      this.parent[rootA] = rootB;
    } else if (this.rank[rootA] > this.rank[rootB]) {
      this.parent[rootB] = rootA;
    } else {
      this.parent[rootB] = rootA;
      this.rank[rootA]++;
    }
    this.groups--;
    return true;
  }
}
