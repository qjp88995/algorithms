import { seededRandom } from '@/lib/random';

import {
  BUOYANCY,
  CLINGS,
  DECAY_CHANCE,
  DECAY_TO,
  DENSITY,
  DISPERSION,
  EMPTY,
  FLAMMABLE,
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

/**
 * 液体找落点时能看多远。等于一个块宽 —— 见 `flow` 里那段解释：
 * 规则的作用半径不能超过脏块唤醒能传播的半径。
 */
const FLOW_REACH = CHUNK;

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
   * 每格记下**最后处理它的帧号**。等于本帧就说明它这一帧已经动过了，
   * 不再处理 —— 否则一粒沙会被自己落到的新位置再捞起来一次。
   *
   * 这里原本存的是帧的奇偶（省内存，也不必每帧清空），那是个会静默锁死
   * 整片流体的错误：一个块睡着期间奇偶一直在翻转，等它被叫醒时，格子里
   * 存的旧奇偶有一半概率恰好等于当前奇偶，于是整块被当成「本帧已处理」
   * 跳过；这一帧没有任何变动，块立刻又睡死，再也醒不过来。
   * 症状是挖开一池静水，凹陷永远不会被填平。帧号不会有这种巧合。
   */
  private clock: Uint32Array;

  chunkCols: number;
  chunkRows: number;
  /** 本帧要处理的块。渲染要拿它画活跃边框，所以是公开的 */
  chunkActive: Uint8Array;
  /** 本帧有变动、于是下一帧要醒着的块 */
  private pending: Uint8Array;

  frame = 0;
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
    this.clock = new Uint32Array(size);

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

  /**
   * 圆形笔刷。半径 0 就是一格。
   *
   * 覆盖规则不是「圆内一律盖掉」，分三档：
   *
   * - 橡皮擦一切；
   * - 石头、木头这类不动的固体可以直接盖上去 —— 在水里隔一道挡板要靠它；
   * - 会流动的东西（粉末 / 液体 / 气体）只落在空格里。
   *
   * 第三条是被一个具体的误会逼出来的：拿火在石墙上刷，整片墙会变成火，
   * 看着就像「石头被点着了」—— 可石头根本不在反应表里，是笔刷把它吃了。
   * 改成只落空格之后，想烧木头就得把火放在它旁边，让规则自己去点。
   */
  paint(cx: number, cy: number, radius: number, id: number) {
    const r2 = radius * radius;
    const overwrite = id === EMPTY || KIND[id] === KIND_STATIC;
    for (let dy = -radius; dy <= radius; dy++) {
      for (let dx = -radius; dx <= radius; dx++) {
        if (dx * dx + dy * dy > r2) continue;
        const x = cx + dx;
        const y = cy + dy;
        if (!this.inside(x, y)) continue;
        if (!overwrite && this.mat[this.index(x, y)] !== EMPTY) continue;
        this.set(x, y, id);
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
    this.clock = new Uint32Array(size);
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
    if (this.clock[i] === this.frame) return;
    this.clock[i] = this.frame;

    // 点火源就算一格都不动也得醒着，否则它旁边的木头永远等不到被点着
    if (RESTLESS[id]) this.touch(x, y);
    if (REACTIVE[id] && this.react(x, y, i, id)) return;

    // 火贴着燃料时既不飘走、也不老化。
    //
    // 少了「不飘走」，木头一着火整格就变成气体火焰、当帧升空，燃料还在
    // 而点火的人跑了；少了「不老化」，火焰自己那十几帧的寿命就成了燃烧
    // 时长的上限 —— 接触面只有木条的横截面，一格火在寿命内堪堪够点燃
    // 一格新木头，增益卡在 1 附近，一根木头总是烧到一半自己灭掉。
    if (CLINGS[id] && this.nearFuel(x, y)) {
      this.touch(x, y);
      return;
    }

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

    // 下不去，就跨过平坦的水面去找一个**能继续往下走**的位置。
    //
    // 这里原本是「只要旁边空着就横向连挪几格」，那是错的：同一高度上的
    // 平移什么都没改变 —— 高度没降、低洼没填。后果是孤零零浮在水面上的
    // 一格水每帧随机挑一边弹出去几格，把水面搅成一排周期恰好等于
    // dispersion 的锯齿，而且陷进极限环：形状不再变化，水却一直在跳，
    // 所在的块永远睡不着。横向流动得有个去处才做。
    // 看得比走得远：视野固定一个块宽，一帧仍只挪 dispersion 格。
    // 视野只有 dispersion 的话，液面会卡成一个正好 45 度的斜坡 ——
    // 每层比下层短 dispersion 格，上面那层刚好够不着下面的落点，
    // 一堆水就像沙子一样堆着摊不平。
    const span = DISPERSION[id];
    if (this.flow(x, y, i, side, span, id)) return;
    if (this.flow(x, y, i, -side, span, id)) return;

    // 还找不到就横着铺开，但**只有头上还压着同类液体时才允许**。
    //
    // 那一句限定是全部的关键：有液柱压着才是压力驱动的铺开，一堆水摊平、
    // 一层浮油摊开靠的都是它；而表面那一格头上什么都没有，横着挪到哪儿
    // 高度都一样 —— 让它挪，它就会每帧随机弹出去几格，把水面搅成锯齿并
    // 永远停不下来。加了这道闸，铺开可以照旧一帧走几格，不会再有伪影。
    if (y > 0 && this.mat[i - this.cols] === id) {
      if (this.slide(x, y, i, side, span, id)) return;
      if (this.slide(x, y, i, -side, span, id)) return;
    }

    // 最后一步：同高度随便挪**一格**。
    //
    // 这一步不降低任何势能，它是纯粹的随机游走，而且非它不可：液面顶上
    // 总有一层填不满整格的水，相邻两级只差一格时，「这边 6 格那边 5 格」
    // 和「这边 5 格那边 6 格」在能量上完全等价 —— 没有任何局部规则推得动
    // 它们。少了这一步，液面会永久卡成一级级一格高的台阶，跨度一超过
    // 视野就再也抹不平。靠随机游走才能让它们统计上摊匀。
    //
    // 必须是一格。一次挪 dispersion 格的话，表面那些孤立的水每帧朝随机
    // 一边弹出去几格，会把液面搅成一排周期恰好等于 dispersion 的锯齿。
    // 代价是液面永远不会完全静止 —— 真实的水面本来也一直在动。
    if (this.tryMove(x, y, i, x + side, y, id)) return;
    this.tryMove(x, y, i, x - side, y, id);
  }

  /**
   * 沿一个方向找第一个「底下能走」的位置，朝它挪过去 ——
   * 一帧最多挪 `span` 格，但**看**得到 `FLOW_REACH` 格外。
   *
   * 视野为什么正好是一个块宽：一格液体能因为多远之外的变化而动起来，
   * 就得保证那么远的变化能把它所在的块叫醒。而 `touch` 只唤醒紧挨着的
   * 块，也就是一个块宽。视野再远，规则上该流的水会因为没人叫醒它而
   * 静静卡住 —— 关掉脏块跳过它立刻又流起来，那种 bug 极难查。
   * **规则能看多远，唤醒就得能传多远。**
   */
  private flow(
    x: number,
    y: number,
    i: number,
    dir: number,
    span: number,
    id: number
  ) {
    for (let k = 1; k <= FLOW_REACH; k++) {
      const nx = x + dir * k;
      if (!this.inside(nx, y)) return false;
      if (!canEnter(id, this.mat[y * this.cols + nx], 0)) return false;
      if (!this.inside(nx, y + 1)) continue;
      if (canEnter(id, this.mat[(y + 1) * this.cols + nx], 1)) {
        // 落点可能比这一帧能走的远，那就朝它走 span 格，下一帧接着走
        const step = k < span ? k : span;
        return this.tryMove(x, y, i, x + dir * step, y, id);
      }
    }
    return false;
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

  /** 四邻还有没有可烧的东西 */
  private nearFuel(x: number, y: number) {
    for (let k = 0; k < 4; k++) {
      const nx = x + NEIGHBOR_X[k];
      const ny = y + NEIGHBOR_Y[k];
      if (!this.inside(nx, ny)) continue;
      if (FLAMMABLE[this.mat[ny * this.cols + nx]]) return true;
    }
    return false;
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

    const { mat, tint, life, clock, frame } = this;
    const m = mat[i];
    mat[i] = mat[j];
    mat[j] = m;
    const t = tint[i];
    tint[i] = tint[j];
    tint[j] = t;
    const l = life[i];
    life[i] = life[j];
    life[j] = l;
    clock[i] = frame;
    clock[j] = frame;

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
    this.clock[i] = this.frame;
    this.touch(x, y);
  }

  /**
   * 把这一格所在的块、连同挨着的八块一起标脏。
   *
   * 为什么是整整一圈而不是只在边界上叫醒对面那块：**规则能看多远，
   * 唤醒就得能传多远**。液体找落点的视野是一个块宽（见 `flow`），
   * 所以块正中间的一格变了，也可能让隔壁块里某格水动起来。
   * 只在边界叫人的话，那格水就永远没人过问 —— 症状是水面卡成一道
   * 阶梯，而把脏块跳过关掉它立刻又流起来。
   */
  private touch(x: number, y: number) {
    const cx = x >> CHUNK_SHIFT;
    const cy = y >> CHUNK_SHIFT;
    this.mark(cx, cy);

    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        if (dx !== 0 || dy !== 0) this.mark(cx + dx, cy + dy);
      }
    }
  }

  private mark(cx: number, cy: number) {
    if (cx < 0 || cx >= this.chunkCols || cy < 0 || cy >= this.chunkRows) {
      return;
    }
    this.pending[cy * this.chunkCols + cx] = 1;
  }
}
