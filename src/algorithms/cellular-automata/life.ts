import type { EdgeMode, LifeRule, LifeStatus, Pattern } from './types';

/**
 * 二维 Life-like 元胞自动机的内核。
 *
 * 「Life-like」指的是这一整族规则：Moore 八邻域、每格两态、下一代
 * 只看自己死活和邻居个数。生命游戏只是其中一条（B3/S23）——
 * 把规则做成参数而不是写死，正是这一页要展示的东西。
 *
 * 不碰 canvas、不碰 React：网格是原地翻转的 `Uint8Array`，
 * 渲染需要的年龄和余晖也一起在这里维护，绘制那一层只管读。
 */

/** 年龄计到 255 就封顶 —— 它只用来着色，再往上没有区别 */
const MAX_AGE = 255;

/** 一个格子死掉之后，余晖还能留几代 */
export const DECAY_FRAMES = 8;

/** 把 `B3/S23` 这样的记号解析成两个 9 位掩码 */
export function parseRule(notation: string): LifeRule {
  const match = /^B(\d*)\/S(\d*)$/i.exec(notation.trim());
  if (!match) throw new Error(`无法解析规则：${notation}`);
  const toMask = (digits: string) =>
    [...digits].reduce((mask, digit) => mask | (1 << Number(digit)), 0);
  return { birth: toMask(match[1]), survive: toMask(match[2]) };
}

export function formatRule(rule: LifeRule): string {
  const toDigits = (mask: number) =>
    Array.from({ length: 9 }, (_, n) => n)
      .filter(n => (mask >> n) & 1)
      .join('');
  return `B${toDigits(rule.birth)}/S${toDigits(rule.survive)}`;
}

export class LifeGrid {
  cols: number;
  rows: number;
  /** 0 / 1，行优先 */
  cells: Uint8Array;
  /** 活细胞已连续存活多少代（新生为 1），死细胞为 0 */
  age: Uint8Array;
  /** 死细胞的余晖倒计时，用来画出运动轨迹 */
  decay: Uint8Array;
  private next: Uint8Array;

  generation = 0;
  population = 0;
  /** 上一步里发生翻转的格子数 */
  changed = 0;

  constructor(cols: number, rows: number) {
    this.cols = cols;
    this.rows = rows;
    const size = cols * rows;
    this.cells = new Uint8Array(size);
    this.age = new Uint8Array(size);
    this.decay = new Uint8Array(size);
    this.next = new Uint8Array(size);
  }

  index(x: number, y: number) {
    return y * this.cols + x;
  }

  get(x: number, y: number) {
    return this.cells[y * this.cols + x];
  }

  set(x: number, y: number, alive: boolean) {
    if (x < 0 || y < 0 || x >= this.cols || y >= this.rows) return;
    const i = y * this.cols + x;
    const was = this.cells[i];
    const now = alive ? 1 : 0;
    if (was === now) return;
    this.cells[i] = now;
    this.age[i] = now;
    this.decay[i] = now ? 0 : DECAY_FRAMES;
    this.population += now ? 1 : -1;
  }

  toggle(x: number, y: number) {
    this.set(x, y, !this.get(x, y));
  }

  clear() {
    this.cells.fill(0);
    this.age.fill(0);
    this.decay.fill(0);
    this.population = 0;
    this.generation = 0;
    this.changed = 0;
  }

  randomize(density: number, random: () => number) {
    this.clear();
    for (let i = 0; i < this.cells.length; i++) {
      if (random() < density) {
        this.cells[i] = 1;
        this.age[i] = 1;
        this.population++;
      }
    }
  }

  /**
   * 把一个图案的左上角落在 `(x, y)`。
   * 越界的部分在环形边界下绕回来，有界时直接丢弃。
   */
  stamp(pattern: Pattern, x: number, y: number, edge: EdgeMode = 'torus') {
    pattern.cells.forEach((line, dy) => {
      [...line].forEach((char, dx) => {
        if (char !== 'O') return;
        let px = x + dx;
        let py = y + dy;
        if (edge === 'torus') {
          px = ((px % this.cols) + this.cols) % this.cols;
          py = ((py % this.rows) + this.rows) % this.rows;
        }
        this.set(px, py, true);
      });
    });
  }

  /**
   * 推进一代。
   *
   * 邻居计数手工展开成三行，越界判断提到行外 —— 这段是整页最热的
   * 循环（格子数 × 8），每格再取一次模的代价并不小。
   */
  step(rule: LifeRule, edge: EdgeMode) {
    const { cols, rows, cells, next, age, decay } = this;
    const torus = edge === 'torus';
    let population = 0;
    let changed = 0;

    for (let y = 0; y < rows; y++) {
      const up = y > 0 ? y - 1 : torus ? rows - 1 : -1;
      const down = y < rows - 1 ? y + 1 : torus ? 0 : -1;
      const rowBase = y * cols;
      const upBase = up * cols;
      const downBase = down * cols;

      for (let x = 0; x < cols; x++) {
        const left = x > 0 ? x - 1 : torus ? cols - 1 : -1;
        const right = x < cols - 1 ? x + 1 : torus ? 0 : -1;

        let n = 0;
        if (up >= 0) {
          if (left >= 0) n += cells[upBase + left];
          n += cells[upBase + x];
          if (right >= 0) n += cells[upBase + right];
        }
        if (left >= 0) n += cells[rowBase + left];
        if (right >= 0) n += cells[rowBase + right];
        if (down >= 0) {
          if (left >= 0) n += cells[downBase + left];
          n += cells[downBase + x];
          if (right >= 0) n += cells[downBase + right];
        }

        const i = rowBase + x;
        const alive = cells[i];
        const mask = alive ? rule.survive : rule.birth;
        const born = (mask >> n) & 1;

        next[i] = born;
        if (born) {
          population++;
          // 年龄跨代累加，封顶之后只影响配色的深浅
          if (!alive) age[i] = 1;
          else if (age[i] < MAX_AGE) age[i]++;
          decay[i] = 0;
        } else {
          age[i] = 0;
          if (alive) decay[i] = DECAY_FRAMES;
          else if (decay[i] > 0) decay[i]--;
        }
        if (born !== alive) changed++;
      }
    }

    this.cells.set(next);
    this.population = population;
    this.changed = changed;
    this.generation++;
  }

  /**
   * 改变网格尺寸，重叠区域的内容原样保留。
   *
   * 画布一 resize 就清盘的话，拖一下窗口正在跑的枪就没了 ——
   * 而这一页里「跑了几百代的格局」本身就是内容。
   */
  resize(cols: number, rows: number) {
    if (cols === this.cols && rows === this.rows) return;
    const size = cols * rows;
    const cells = new Uint8Array(size);
    const age = new Uint8Array(size);
    const decay = new Uint8Array(size);
    const copyCols = Math.min(cols, this.cols);
    const copyRows = Math.min(rows, this.rows);
    let population = 0;

    for (let y = 0; y < copyRows; y++) {
      for (let x = 0; x < copyCols; x++) {
        const from = y * this.cols + x;
        const to = y * cols + x;
        cells[to] = this.cells[from];
        age[to] = this.age[from];
        decay[to] = this.decay[from];
        population += cells[to];
      }
    }

    this.cols = cols;
    this.rows = rows;
    this.cells = cells;
    this.age = age;
    this.decay = decay;
    this.next = new Uint8Array(size);
    this.population = population;
  }

  /** FNV-1a，给周期检测用 */
  hash() {
    let hash = 0x811c9dc5;
    const { cells } = this;
    for (let i = 0; i < cells.length; i++) {
      hash ^= cells[i];
      hash = Math.imul(hash, 0x01000193);
    }
    return hash >>> 0;
  }
}

/**
 * 周期检测器：环形缓冲，记住最近 `capacity` 代的哈希和快照。
 *
 * 只靠哈希会误报，所以命中之后还要逐字节比一遍 —— 一页里「进入
 * 周期 30」这种断言，错一次就不可信了。
 *
 * 容量有限意味着只认得出短周期：滑翔机枪是 30，脉冲星是 3，
 * 常见的振荡子都在 64 以内；更长的周期这里一律报「还在跑」，
 * 而不会报错 —— 这本来也不可能靠有限观察判定。
 */
export class CycleDetector {
  private readonly capacity: number;
  private hashes: Uint32Array;
  private gens: Int32Array;
  private snapshots: Uint8Array[] = [];
  private cursor = 0;
  private filled = 0;
  private size = 0;

  constructor(capacity = 64) {
    this.capacity = capacity;
    this.hashes = new Uint32Array(capacity);
    this.gens = new Int32Array(capacity);
  }

  reset() {
    this.cursor = 0;
    this.filled = 0;
  }

  /** 记下这一代；如果和缓冲里某一代完全相同，返回两者的代数差 */
  push(cells: Uint8Array, generation: number, hash: number): number | null {
    if (cells.length !== this.size) {
      this.size = cells.length;
      this.snapshots = Array.from(
        { length: this.capacity },
        () => new Uint8Array(cells.length)
      );
      this.reset();
    }

    let period: number | null = null;
    for (let k = 0; k < this.filled; k++) {
      if (this.hashes[k] !== hash) continue;
      if (!equals(this.snapshots[k], cells)) continue;
      period = generation - this.gens[k];
      break;
    }

    this.hashes[this.cursor] = hash;
    this.gens[this.cursor] = generation;
    this.snapshots[this.cursor].set(cells);
    this.cursor = (this.cursor + 1) % this.capacity;
    this.filled = Math.min(this.filled + 1, this.capacity);

    return period;
  }
}

function equals(a: Uint8Array, b: Uint8Array) {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
  return true;
}

/**
 * 把三个观测量翻译成一句人话。
 *
 * 注意「还在跑」不等于「不会停」—— 生命游戏是图灵完备的，
 * 一个格局最终会不会安定下来不可判定。这里只报观察到的事实。
 */
export function classify(
  population: number,
  changed: number,
  period: number | null
): LifeStatus {
  if (population === 0) return { kind: 'extinct' };
  if (changed === 0) return { kind: 'still' };
  if (period !== null && period > 0) return { kind: 'cycle', period };
  return { kind: 'running' };
}
