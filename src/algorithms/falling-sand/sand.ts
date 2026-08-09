import { seededRandom } from '@/lib/random';

import {
  BUOYANCY,
  DECAY_CHANCE,
  DECAY_TO,
  DENSITY,
  DISPERSION,
  EMPTY,
  KIND,
  KIND_GAS,
  KIND_LIQUID,
  KIND_POWDER,
  KIND_STATIC,
  LIFE_MAX,
  LIFE_MIN,
  MATERIAL_COUNT,
  REACT_CHANCE,
  REACT_OTHER,
  REACT_SELF,
  REACTIVE,
  RESTLESS,
} from './materials';
import type { SandOptions, SandStats } from './types';

/**
 * 落沙内核 —— Noita 那套「Falling Everything」的最小可运行版本。
 *
 * 世界就是一张 `Uint8Array`，一格一个材质编号。每帧从下往上扫一遍，
 * 每格按自己的类别问几句「下面能不能去」，能就交换两格。没有速度、没有
 * 受力分析、没有压强求解 —— 水面会自己找平，沙会自己堆成锥形，
 * 都是这几条局部规则撞出来的。
 *
 * 三个让它能跑起来的工程决定，全都做成了可开关的参数（`SandOptions`），
 * 因为关掉之后的样子才说得清它们各自在防什么：
 *
 * - **chunk 脏标记**：世界切成 16×16 的块，只有「上一帧有像素动过」的块
 *   参与更新。一屏静止的石头和沉底的水直接整块跳过。
 * - **自底向上扫描**：先处理最底下那粒，它让出的位置正好给上面一粒。
 *   反过来从上往下扫，上面那粒每次都被下面还没走的同伴挡住，
 *   一整柱沙就只能从底部一粒一粒漏，看着像在融化而不是在下落。
 * - **水平方向逐帧翻转**：固定从左往右扫，整堆沙子会集体朝一侧漂，
 *   因为每粒沙的左邻居总是先被处理。
 *
 * 每格另外存两个字节：`tint` 是固定的亮度抖动（沙子的颗粒感），
 * `life` 是火 / 烟 / 蒸汽的剩余寿命。它们跟着材质一起交换 ——
 * 一粒沙搬家时得把自己的颜色带走，否则整片沙会像电视雪花一样闪。
 */

export const CHUNK_SHIFT = 4;
export const CHUNK = 1 << CHUNK_SHIFT;
const CHUNK_MASK = CHUNK - 1;

/** 四邻的偏移。反应只看上下左右：带上斜角，火会蔓延得快到看不清过程 */
const NEIGHBOR_X = [0, 0, -1, 1];
const NEIGHBOR_Y = [-1, 1, 0, 0];

/**
 * self 这格能不能移到 target 那格去。
 *
 * `dy` 是移动方向：往下走要比对方重，往上浮要比对方轻，
 * 横着挪只让重的推开轻的（否则水和油会原地无限对调）。
 * 静态固体和粉末一律钻不过去 —— 沙堆能挡住水，靠的就是这一句。
 */
function canEnter(self: number, target: number, dy: number): boolean {
  if (target === EMPTY) return true;
  const kind = KIND[target];
  if (kind === KIND_STATIC || kind === KIND_POWDER) return false;
  return dy < 0
    ? DENSITY[self] < DENSITY[target]
    : DENSITY[self] > DENSITY[target];
}

export class SandWorld {
  cols: number;
  rows: number;
  mat: Uint8Array;
  tint: Uint8Array;
  life: Uint8Array;
  /**
   * 每格记下「最后处理它的那一帧的奇偶」。等于本帧的奇偶就说明它这一帧
   * 已经动过了，不再处理 —— 否则一粒沙会被自己落到的新位置再捞起来一次。
   * 存奇偶而不是帧号，是为了不必每帧清空这块内存。
   */
  private clock: Uint8Array;

  chunkCols: number;
  chunkRows: number;
  /** 本帧要处理的块。渲染要拿它画活跃边框，所以是公开的 */
  chunkActive: Uint8Array;
  /** 本帧有变动、于是下一帧要醒着的块 */
  private pending: Uint8Array;

  frame = 0;
  private parity = 0;
  private rand: () => number;

  /** 非空像素数。增删时顺手维护，比每帧数一遍便宜 */
  filled = 0;
  private scanned = 0;
  private moved = 0;
  private awake = 0;

  constructor(cols: number, rows: number, seed = 1) {
    this.cols = cols;
    this.rows = rows;
    this.rand = seededRandom(seed);

    const size = cols * rows;
    this.mat = new Uint8Array(size);
    this.tint = new Uint8Array(size);
    this.life = new Uint8Array(size);
    this.clock = new Uint8Array(size);

    this.chunkCols = Math.ceil(cols / CHUNK);
    this.chunkRows = Math.ceil(rows / CHUNK);
    const chunks = this.chunkCols * this.chunkRows;
    this.chunkActive = new Uint8Array(chunks);
    // 第一帧全醒着：初始场景摆好的东西得有机会开始动
    this.pending = new Uint8Array(chunks).fill(1);
  }

  index(x: number, y: number) {
    return y * this.cols + x;
  }

  inside(x: number, y: number) {
    return x >= 0 && x < this.cols && y >= 0 && y < this.rows;
  }

  get(x: number, y: number) {
    return this.inside(x, y) ? this.mat[this.index(x, y)] : EMPTY;
  }

  /** 放一格材质。笔刷、场景、内核内部的相变都走这里 */
  set(x: number, y: number, id: number) {
    if (!this.inside(x, y)) return;
    this.write(this.index(x, y), x, y, id);
  }

  /** 圆形笔刷。半径 0 就是一格 */
  paint(cx: number, cy: number, radius: number, id: number) {
    const r2 = radius * radius;
    for (let dy = -radius; dy <= radius; dy++) {
      for (let dx = -radius; dx <= radius; dx++) {
        if (dx * dx + dy * dy > r2) continue;
        this.set(cx + dx, cy + dy, id);
      }
    }
  }

  clear() {
    this.mat.fill(EMPTY);
    this.life.fill(0);
    this.filled = 0;
    this.pending.fill(1);
  }

  /** 画布尺寸变了：内容按左上角对齐留着，不然一拖窗口就白干 */
  resize(cols: number, rows: number) {
    if (cols === this.cols && rows === this.rows) return;
    const old = {
      cols: this.cols,
      rows: this.rows,
      mat: this.mat,
      tint: this.tint,
      life: this.life,
    };

    const size = cols * rows;
    this.cols = cols;
    this.rows = rows;
    this.mat = new Uint8Array(size);
    this.tint = new Uint8Array(size);
    this.life = new Uint8Array(size);
    this.clock = new Uint8Array(size);
    this.chunkCols = Math.ceil(cols / CHUNK);
    this.chunkRows = Math.ceil(rows / CHUNK);
    const chunks = this.chunkCols * this.chunkRows;
    this.chunkActive = new Uint8Array(chunks);
    this.pending = new Uint8Array(chunks).fill(1);

    const copyCols = Math.min(cols, old.cols);
    const copyRows = Math.min(rows, old.rows);
    let filled = 0;
    for (let y = 0; y < copyRows; y++) {
      const from = y * old.cols;
      const to = y * cols;
      for (let x = 0; x < copyCols; x++) {
        const id = old.mat[from + x];
        this.mat[to + x] = id;
        this.tint[to + x] = old.tint[from + x];
        this.life[to + x] = old.life[from + x];
        if (id !== EMPTY) filled++;
      }
    }
    this.filled = filled;
  }

  stats(): SandStats {
    return {
      frame: this.frame,
      filled: this.filled,
      activeChunks: this.awake,
      totalChunks: this.chunkActive.length,
      scanned: this.scanned,
      moved: this.moved,
    };
  }

  // ─── 一帧 ───────────────────────────────────────────────────

  step(options: SandOptions) {
    this.frame++;
    this.parity ^= 1;
    this.scanned = 0;
    this.moved = 0;

    const { chunkActive, pending, chunkCols, chunkRows, cols, rows } = this;
    if (options.useChunks) {
      // 上一帧攒下的脏块就是这一帧的工作量，攒完立刻清空给这一帧用
      chunkActive.set(pending);
    } else {
      chunkActive.fill(1);
    }
    pending.fill(0);

    let awake = 0;
    for (let k = 0; k < chunkActive.length; k++) {
      if (chunkActive[k]) awake++;
    }
    this.awake = awake;

    // 水平方向逐帧翻转，把「先处理谁」的偏差在时间上摊平
    const dir = options.alternateScan && (this.frame & 1) === 0 ? -1 : 1;
    const up = options.bottomUp;

    const cyStart = up ? chunkRows - 1 : 0;
    const cyStop = up ? -1 : chunkRows;
    const cyStep = up ? -1 : 1;

    for (let cy = cyStart; cy !== cyStop; cy += cyStep) {
      const base = cy * chunkCols;
      let any = false;
      for (let cx = 0; cx < chunkCols; cx++) {
        if (chunkActive[base + cx]) {
          any = true;
          break;
        }
      }
      if (!any) continue;

      const y0 = cy << CHUNK_SHIFT;
      const y1 = Math.min(rows, y0 + CHUNK);
      const yStart = up ? y1 - 1 : y0;
      const yStop = up ? y0 - 1 : y1;
      const yStep = up ? -1 : 1;

      for (let y = yStart; y !== yStop; y += yStep) {
        if (dir > 0) {
          for (let cx = 0; cx < chunkCols; cx++) {
            if (!chunkActive[base + cx]) continue;
            const x0 = cx << CHUNK_SHIFT;
            const x1 = Math.min(cols, x0 + CHUNK);
            for (let x = x0; x < x1; x++) this.update(x, y);
            this.scanned += x1 - x0;
          }
        } else {
          for (let cx = chunkCols - 1; cx >= 0; cx--) {
            if (!chunkActive[base + cx]) continue;
            const x0 = cx << CHUNK_SHIFT;
            const x1 = Math.min(cols, x0 + CHUNK);
            for (let x = x1 - 1; x >= x0; x--) this.update(x, y);
            this.scanned += x1 - x0;
          }
        }
      }
    }
  }

  private update(x: number, y: number) {
    const i = y * this.cols + x;
    const id = this.mat[i];
    if (id === EMPTY) return;
    if (this.clock[i] === this.parity) return;
    this.clock[i] = this.parity;

    // 点火源就算一格都不动也得醒着，否则它旁边的木头永远等不到被点着
    if (RESTLESS[id]) this.touch(x, y);
    if (REACTIVE[id] && this.react(x, y, i, id)) return;
    if (LIFE_MAX[id] > 0 && this.age(x, y, i, id)) return;

    switch (KIND[id]) {
      case KIND_POWDER:
        this.movePowder(x, y, i, id);
        break;
      case KIND_LIQUID:
        this.moveLiquid(x, y, i, id);
        break;
      case KIND_GAS:
        this.moveGas(x, y, i, id);
        break;
      default:
        // 石头和木头不动。它们只在被别人点着时才会变
        break;
    }
  }

  /** 挨着谁就变成什么。返回 true 表示这一格已经不是原来的东西了 */
  private react(x: number, y: number, i: number, id: number) {
    const base = id * MATERIAL_COUNT;
    for (let k = 0; k < 4; k++) {
      const nx = x + NEIGHBOR_X[k];
      const ny = y + NEIGHBOR_Y[k];
      if (!this.inside(nx, ny)) continue;
      const j = ny * this.cols + nx;
      const other = this.mat[j];
      const becomeSelf = REACT_SELF[base + other];
      if (becomeSelf < 0) continue;
      if (this.rand() >= REACT_CHANCE[base + other]) continue;

      const becomeOther = REACT_OTHER[base + other];
      this.write(i, x, y, becomeSelf);
      if (becomeOther !== other) this.write(j, nx, ny, becomeOther);
      return true;
    }
    return false;
  }

  /** 烧掉一格寿命。归零就相变 —— 火留下烟，蒸汽凝回水 */
  private age(x: number, y: number, i: number, id: number) {
    const left = this.life[i] - 1;
    if (left > 0) {
      this.life[i] = left;
      // 还在变的东西不能让所在块睡着
      this.touch(x, y);
      return false;
    }
    const next = this.rand() < DECAY_CHANCE[id] ? DECAY_TO[id] : EMPTY;
    this.write(i, x, y, next);
    return true;
  }

  // ─── 四类材质各自的运动 ─────────────────────────────────────

  private movePowder(x: number, y: number, i: number, id: number) {
    if (this.tryMove(x, y, i, x, y + 1, id)) return;
    // 先试哪一边由随机数定。固定先左的话，沙堆会长成一边陡一边缓
    const side = this.rand() < 0.5 ? -1 : 1;
    if (this.tryMove(x, y, i, x + side, y + 1, id)) return;
    this.tryMove(x, y, i, x - side, y + 1, id);
  }

  private moveLiquid(x: number, y: number, i: number, id: number) {
    if (this.tryMove(x, y, i, x, y + 1, id)) return;
    const side = this.rand() < 0.5 ? -1 : 1;
    if (this.tryMove(x, y, i, x + side, y + 1, id)) return;
    if (this.tryMove(x, y, i, x - side, y + 1, id)) return;

    // 下不去就铺开：沿一个方向连着挪，一帧最多 dispersion 格。
    // 这就是「水面找平」的全部实现 —— 没有压强，只有一格一格挤过去
    const span = DISPERSION[id];
    if (this.slide(x, y, i, side, span, id)) return;
    this.slide(x, y, i, -side, span, id);
  }

  private moveGas(x: number, y: number, i: number, id: number) {
    let cx = x;
    let ci = i;
    let cy = y;
    // 上浮是概率性的，不然火焰会像喷泉一样笔直冲顶
    if (this.rand() < BUOYANCY[id]) {
      const side = this.rand() < 0.5 ? -1 : 1;
      if (this.tryMove(x, y, i, x, y - 1, id)) {
        cy = y - 1;
        ci = i - this.cols;
      } else if (this.tryMove(x, y, i, x + side, y - 1, id)) {
        cx = x + side;
        cy = y - 1;
        ci = ci - this.cols + side;
      } else if (this.tryMove(x, y, i, x - side, y - 1, id)) {
        cx = x - side;
        cy = y - 1;
        ci = ci - this.cols - side;
      }
    }

    const span = DISPERSION[id];
    if (span === 0) return;
    const drift = this.rand() < 0.5 ? -1 : 1;
    this.slide(cx, cy, ci, drift, 1 + ((this.rand() * span) | 0), id);
  }

  /** 沿水平方向连续挪，返回是否挪动过 */
  private slide(
    x: number,
    y: number,
    i: number,
    dir: number,
    span: number,
    id: number
  ) {
    let cx = x;
    let ci = i;
    for (let k = 0; k < span; k++) {
      if (!this.tryMove(cx, y, ci, cx + dir, y, id)) break;
      cx += dir;
      ci += dir;
    }
    return cx !== x;
  }

  private tryMove(
    x: number,
    y: number,
    i: number,
    tx: number,
    ty: number,
    id: number
  ) {
    if (!this.inside(tx, ty)) return false;
    const j = ty * this.cols + tx;
    if (!canEnter(id, this.mat[j], ty - y)) return false;

    const { mat, tint, life, clock, parity } = this;
    const m = mat[i];
    mat[i] = mat[j];
    mat[j] = m;
    const t = tint[i];
    tint[i] = tint[j];
    tint[j] = t;
    const l = life[i];
    life[i] = life[j];
    life[j] = l;
    clock[i] = parity;
    clock[j] = parity;

    this.touch(x, y);
    this.touch(tx, ty);
    this.moved++;
    return true;
  }

  // ─── 脏块 ───────────────────────────────────────────────────

  /** 写一格材质：顺带补上颜色抖动、寿命，并把所在块叫醒 */
  private write(i: number, x: number, y: number, id: number) {
    const prev = this.mat[i];
    if (prev === id) return;
    if (prev === EMPTY) this.filled++;
    else if (id === EMPTY) this.filled--;

    this.mat[i] = id;
    this.tint[i] = (this.rand() * 256) | 0;
    const span = LIFE_MAX[id] - LIFE_MIN[id];
    this.life[i] =
      LIFE_MAX[id] > 0 ? LIFE_MIN[id] + ((this.rand() * (span + 1)) | 0) : 0;
    this.clock[i] = this.parity;
    this.touch(x, y);
  }

  /**
   * 把这一格所在的块标脏。
   *
   * 落在块边界上时还要叫醒挨着的那一块 —— 一格像素的下一步可能跨过边界，
   * 而那一块此刻也许正睡着。漏掉这一步的表现很典型：沙子流到块边缘就
   * 卡住不动，直到别的东西碰它一下才继续。
   */
  private touch(x: number, y: number) {
    const cx = x >> CHUNK_SHIFT;
    const cy = y >> CHUNK_SHIFT;
    this.mark(cx, cy);

    const lx = x & CHUNK_MASK;
    const ly = y & CHUNK_MASK;
    const left = lx === 0;
    const right = lx === CHUNK_MASK;
    const top = ly === 0;
    const bottom = ly === CHUNK_MASK;
    if (left) this.mark(cx - 1, cy);
    if (right) this.mark(cx + 1, cy);
    if (top) this.mark(cx, cy - 1);
    if (bottom) this.mark(cx, cy + 1);
    if (left && top) this.mark(cx - 1, cy - 1);
    if (right && top) this.mark(cx + 1, cy - 1);
    if (left && bottom) this.mark(cx - 1, cy + 1);
    if (right && bottom) this.mark(cx + 1, cy + 1);
  }

  private mark(cx: number, cy: number) {
    if (cx < 0 || cx >= this.chunkCols || cy < 0 || cy >= this.chunkRows) {
      return;
    }
    this.pending[cy * this.chunkCols + cx] = 1;
  }
}
