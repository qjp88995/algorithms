/**
 * 一维初等元胞自动机（Elementary Cellular Automaton）。
 *
 * 一行格子，每格只看自己和左右两个邻居 —— 三格两态共 8 种局面，
 * 每种局面指定一个输出，于是规则总共只有 2^8 = 256 条，可以整个
 * 枚举完。Wolfram 编号就是把 8 个输出当成一个二进制数：
 * 第 `lcr` 位（l、c、r 各占一位）的取值即该局面的下一状态。
 *
 * 时间画成第二个维度：每代往下堆一行，整张时空图就是这条规则的
 * 全部行为。二维的生命游戏只能看到「此刻」，这里能一眼看完历史。
 */

/** 8 个邻域局面，从 111 到 000 —— 和 Wolfram 编号的位序一致（高位在左） */
export const NEIGHBORHOODS = [7, 6, 5, 4, 3, 2, 1, 0] as const;

/** 规则编号里，某个邻域局面对应的输出 */
export function ruleBit(rule: number, neighborhood: number) {
  return (rule >> neighborhood) & 1;
}

/** 把邻域编号画成 `111` 这样的三格图案 */
export function neighborhoodCells(
  neighborhood: number
): [number, number, number] {
  return [(neighborhood >> 2) & 1, (neighborhood >> 1) & 1, neighborhood & 1];
}

export class ElementaryCA {
  width: number;
  /** 时空图最多显示多少行 */
  capacity: number;
  /** capacity × width 的环形缓冲，一行一代 */
  rows: Uint8Array;
  private cursor = 0;
  /** 已生成的行数，封顶到 capacity */
  filled = 0;
  generation = 0;
  population = 0;

  constructor(width: number, capacity: number) {
    this.width = width;
    this.capacity = capacity;
    this.rows = new Uint8Array(width * capacity);
  }

  /** 逻辑行 `i`（0 是画面最上方那行）在缓冲里的起始下标 */
  offsetOf(i: number) {
    const start = this.filled < this.capacity ? 0 : this.cursor;
    return ((start + i) % this.capacity) * this.width;
  }

  private pushRow(fill: (row: Uint8Array, offset: number) => void) {
    const offset = this.cursor * this.width;
    this.rows.fill(0, offset, offset + this.width);
    fill(this.rows, offset);
    this.cursor = (this.cursor + 1) % this.capacity;
    this.filled = Math.min(this.filled + 1, this.capacity);
    let population = 0;
    for (let x = 0; x < this.width; x++) population += this.rows[offset + x];
    this.population = population;
  }

  private reset() {
    this.rows.fill(0);
    this.cursor = 0;
    this.filled = 0;
    this.generation = 0;
    this.population = 0;
  }

  /** 正中央一个活细胞 —— 看规则本身长什么样，就该从最简单的初值出发 */
  seedSingle() {
    this.reset();
    this.pushRow((row, offset) => {
      row[offset + (this.width >> 1)] = 1;
    });
  }

  seedRandom(density: number, random: () => number) {
    this.reset();
    this.pushRow((row, offset) => {
      for (let x = 0; x < this.width; x++) {
        row[offset + x] = random() < density ? 1 : 0;
      }
    });
  }

  /** 按当前最后一行推出下一行；左右环形相接 */
  step(rule: number) {
    if (this.filled === 0) this.seedSingle();
    const { width } = this;
    const prev = ((this.cursor - 1 + this.capacity) % this.capacity) * width;
    // 先读完整行再写，否则新行会读到自己刚写下的值
    const source = this.rows.slice(prev, prev + width);

    this.pushRow((row, offset) => {
      for (let x = 0; x < width; x++) {
        const l = source[(x - 1 + width) % width];
        const c = source[x];
        const r = source[(x + 1) % width];
        row[offset + x] = ruleBit(rule, (l << 2) | (c << 1) | r);
      }
    });
    this.generation++;
  }

  /**
   * 换尺寸就重来。
   *
   * 二维那边 resize 保留内容是因为「跑了几百代的格局」本身是内容；
   * 这里时空图的每一行都绑死在当时的宽度上，横向一变，历史就对不齐了。
   */
  resize(width: number, capacity: number) {
    if (width === this.width && capacity === this.capacity) return;
    this.width = width;
    this.capacity = capacity;
    this.rows = new Uint8Array(width * capacity);
    this.reset();
  }
}
