import {
  cellCount,
  cellNeighbors,
  eachCell,
  indexOf,
  type MazeGrid,
  wallBetween,
} from './grid';

/**
 * 四种迷宫生成算法，全部写成可单步执行的形式。
 *
 * 它们的产物是同一种东西 —— 一棵覆盖所有通道格的生成树（完美迷宫，
 * 无环、任意两点路径唯一）。差别全在**怎么长出来**，而这直接决定了
 * 迷宫的手感：递归回溯挖出细长走廊，Prim 像霉斑一样均匀蔓延，
 * Kruskal 到处随机连线、后期才并成一片，Wilson 前期看着在瞎走。
 *
 * 单步是为了做动画，也让"长法"本身可以被看见 ——
 * 只看最终结果的话，四种迷宫乍看都差不多。
 */
export type MazeAlgorithm = 'backtracker' | 'prim' | 'kruskal' | 'wilson';

/** 每格在生成过程中的角色，用来着色 */
export const MARK_NONE = 0;
/** 已经并入迷宫 */
export const MARK_IN = 1;
/** 在活跃集合里：栈上 / frontier / 正在被游走 */
export const MARK_ACTIVE = 2;

export interface MazeGenStats {
  /** 已并入迷宫的通道格数 */
  carved: number;
  /** 通道格总数 */
  total: number;
  /** 活跃规模：栈深 / frontier 大小 / 游走长度 */
  active: number;
  /**
   * 执行过的步数。对前三种约等于 carved，Wilson 会高出一个数量级 ——
   * 它为了均匀随机付出的代价就体现在这里。
   */
  steps: number;
  done: boolean;
}

export abstract class MazeGenerator {
  readonly grid: MazeGrid;
  /** 每格的角色，长度同 walls */
  readonly mark: Uint8Array;
  /** 当前正在操作的格子，-1 表示没有 */
  cursor = -1;
  /** 是否按连通分量着色 —— 只有 Kruskal 有多个分量可看 */
  readonly showsComponents: boolean = false;

  readonly total: number;
  protected readonly random: () => number;
  protected readonly buffer = new Int32Array(4);
  protected carved = 0;
  protected steps = 0;
  protected finished = false;

  constructor(grid: MazeGrid, random: () => number) {
    this.grid = grid;
    this.random = random;
    this.mark = new Uint8Array(grid.walls.length);
    this.total = cellCount(grid);
    grid.walls.fill(1);
  }

  get done() {
    return this.finished;
  }

  abstract step(): boolean;

  /** 该格所属的连通分量，用于着色；只有 Kruskal 会返回多个值 */
  componentOf(_index: number): number {
    return 0;
  }

  advance(steps: number): number {
    let taken = 0;
    while (taken < steps && !this.finished) {
      this.step();
      taken++;
    }
    return taken;
  }

  /** Wilson 的步数是随机的，上限给得宽一些，纯粹是防死循环 */
  runToEnd(limit = 4_000_000) {
    let guard = 0;
    while (!this.finished && guard++ < limit) this.step();
  }

  stats(): MazeGenStats {
    return {
      carved: this.carved,
      total: this.total,
      active: this.activeSize(),
      steps: this.steps,
      done: this.finished,
    };
  }

  protected abstract activeSize(): number;

  /** 把一个通道格并入迷宫 */
  protected openCell(index: number) {
    if (this.grid.walls[index] === 1) {
      this.grid.walls[index] = 0;
      this.carved++;
    }
    this.mark[index] = MARK_IN;
  }

  /** 打通两个相邻通道格之间的那堵墙 */
  protected connect(a: number, b: number) {
    this.grid.walls[wallBetween(this.grid, a, b)] = 0;
  }

  protected randomCell(): number {
    const cols = Math.floor((this.grid.cols - 1) / 2);
    const rows = Math.floor((this.grid.rows - 1) / 2);
    const x = Math.floor(this.random() * cols) * 2 + 1;
    const y = Math.floor(this.random() * rows) * 2 + 1;
    return indexOf(this.grid, x, y);
  }
}

/**
 * 递归回溯（深度优先 + 随机邻居）。
 *
 * 一条"蛇"一直往前钻，钻不动了才退回最近的岔口。因为总是走到底再回头，
 * 通道细长、拐弯多、死胡同相对少 —— 是四种里最像"人手画的迷宫"的一种。
 */
class Backtracker extends MazeGenerator {
  private readonly stack: number[] = [];

  constructor(grid: MazeGrid, random: () => number) {
    super(grid, random);
    const start = this.randomCell();
    this.openCell(start);
    this.mark[start] = MARK_ACTIVE;
    this.stack.push(start);
    this.cursor = start;
  }

  step(): boolean {
    if (this.finished) return true;
    if (this.stack.length === 0) {
      this.finished = true;
      this.cursor = -1;
      return true;
    }

    const current = this.stack[this.stack.length - 1];
    const count = cellNeighbors(this.grid, current, this.buffer);
    const candidates: number[] = [];
    for (let i = 0; i < count; i++) {
      if (this.grid.walls[this.buffer[i]] === 1)
        candidates.push(this.buffer[i]);
    }

    this.steps++;

    // 无路可走就退栈 —— 这一下"缩回去"正是深度优先的招牌动作
    if (candidates.length === 0) {
      this.mark[current] = MARK_IN;
      this.stack.pop();
      this.cursor = this.stack[this.stack.length - 1] ?? -1;
      return false;
    }

    const next = candidates[Math.floor(this.random() * candidates.length)];
    this.connect(current, next);
    this.openCell(next);
    this.mark[next] = MARK_ACTIVE;
    this.stack.push(next);
    this.cursor = next;
    return false;
  }

  protected activeSize() {
    return this.stack.length;
  }
}

/**
 * 随机化 Prim。
 *
 * 维护一圈"和迷宫接壤但还没并进来"的格子，每次随机挑一个并入。
 * 因为挑的是整圈里的随机一个而不是最近一个，迷宫从种子点向四周
 * 均匀蔓延，分叉又密又短，死胡同明显比递归回溯多。
 */
class Prim extends MazeGenerator {
  private frontier: number[] = [];

  constructor(grid: MazeGrid, random: () => number) {
    super(grid, random);
    const start = this.randomCell();
    this.openCell(start);
    this.cursor = start;
    this.pushFrontier(start);
  }

  step(): boolean {
    if (this.finished) return true;
    if (this.frontier.length === 0) {
      this.finished = true;
      this.cursor = -1;
      return true;
    }

    const pick = Math.floor(this.random() * this.frontier.length);
    const cell = this.frontier[pick];
    this.frontier[pick] = this.frontier[this.frontier.length - 1];
    this.frontier.pop();

    // 连到一个已在迷宫里的随机邻居
    const count = cellNeighbors(this.grid, cell, this.buffer);
    const inside: number[] = [];
    for (let i = 0; i < count; i++) {
      if (this.grid.walls[this.buffer[i]] === 0) inside.push(this.buffer[i]);
    }
    if (inside.length > 0) {
      this.connect(cell, inside[Math.floor(this.random() * inside.length)]);
    }

    this.openCell(cell);
    this.cursor = cell;
    this.pushFrontier(cell);
    this.steps++;
    return false;
  }

  private pushFrontier(cell: number) {
    const count = cellNeighbors(this.grid, cell, this.buffer);
    for (let i = 0; i < count; i++) {
      const next = this.buffer[i];
      if (this.grid.walls[next] === 0) continue;
      if (this.mark[next] === MARK_ACTIVE) continue;
      this.mark[next] = MARK_ACTIVE;
      this.frontier.push(next);
    }
  }

  protected activeSize() {
    return this.frontier.length;
  }
}

/**
 * 随机 Kruskal。
 *
 * 一上来所有通道格就都是独立的小房间，然后把所有墙打乱，逐堵考察：
 * 两边属于不同连通块就拆掉，否则留着（拆了会成环）。
 * 画面上是一堆彩色斑块各自长大再并成一片 —— 这是四种里唯一能
 * 直接看见"并查集在合并"的。
 */
class Kruskal extends MazeGenerator {
  readonly showsComponents = true;

  private readonly edges: [number, number][] = [];
  private readonly parent: Int32Array;
  private at = 0;
  private sets: number;

  constructor(grid: MazeGrid, random: () => number) {
    super(grid, random);

    // 先把所有房间开出来，Kruskal 是从"全是孤岛"开始的
    eachCell(grid, index => this.openCell(index));

    this.parent = new Int32Array(grid.walls.length).fill(-1);
    eachCell(grid, index => {
      this.parent[index] = index;
    });
    this.sets = this.total;

    eachCell(grid, index => {
      const count = cellNeighbors(grid, index, this.buffer);
      for (let i = 0; i < count; i++) {
        // 只从小到大收一次，免得每堵墙进来两遍
        if (this.buffer[i] > index) this.edges.push([index, this.buffer[i]]);
      }
    });
    shuffle(this.edges, random);
  }

  step(): boolean {
    if (this.finished) return true;

    while (this.at < this.edges.length) {
      const [a, b] = this.edges[this.at++];
      const rootA = this.find(a);
      const rootB = this.find(b);
      this.steps++;
      if (rootA === rootB) continue; // 拆了会成环

      this.parent[rootB] = rootA;
      this.sets--;
      this.connect(a, b);
      this.cursor = b;
      return false;
    }

    this.finished = true;
    this.cursor = -1;
    return true;
  }

  componentOf(index: number): number {
    if (this.parent[index] < 0) return 0;
    return this.find(index);
  }

  protected activeSize() {
    return this.sets;
  }

  private find(x: number): number {
    let node = x;
    while (this.parent[node] !== node) {
      // 路径压缩，顺手把树压扁
      this.parent[node] = this.parent[this.parent[node]];
      node = this.parent[node];
    }
    return node;
  }
}

/**
 * Wilson（环消除随机游走）。
 *
 * 从迷宫外随便找一格开始瞎走，走出环就把环整个抹掉，直到撞上已有的
 * 迷宫，再把这一路定型下来。代价极高 —— 步数比另外三种高一个数量级，
 * 前期看着就是在原地打转 —— 换来的是**均匀性**：它在所有可能的生成树里
 * 等概率抽样，另外三种都有各自的偏好。
 */
class Wilson extends MazeGenerator {
  private readonly direction: Int32Array;
  private readonly pending: number[] = [];
  private walkStart = -1;
  private walkAt = -1;
  private walkLength = 0;

  constructor(grid: MazeGrid, random: () => number) {
    super(grid, random);
    this.direction = new Int32Array(grid.walls.length).fill(-1);
    eachCell(grid, index => this.pending.push(index));
    this.openCell(this.takePending());
  }

  step(): boolean {
    if (this.finished) return true;

    // 上一趟走完了，另起一趟
    if (this.walkAt < 0) {
      const start = this.takePending();
      if (start < 0) {
        this.finished = true;
        this.cursor = -1;
        return true;
      }
      this.walkStart = start;
      this.walkAt = start;
      this.walkLength = 1;
      this.mark[start] = MARK_ACTIVE;
      this.cursor = start;
      return false;
    }

    const count = cellNeighbors(this.grid, this.walkAt, this.buffer);
    const next = this.buffer[Math.floor(this.random() * count)];
    // 覆盖式记录：走出环时环上旧的方向被盖掉，环就这么消失了
    this.direction[this.walkAt] = next;
    this.steps++;

    if (this.grid.walls[next] === 0) {
      this.carveWalk();
      this.walkAt = -1;
      this.cursor = next;
      return false;
    }

    if (this.mark[next] !== MARK_ACTIVE) this.walkLength++;
    this.mark[next] = MARK_ACTIVE;
    this.walkAt = next;
    this.cursor = next;
    return false;
  }

  protected activeSize() {
    return this.walkAt < 0 ? 0 : this.walkLength;
  }

  /** 从起点沿记录的方向走一遍并刻出来 —— 环上的格子自然被跳过 */
  private carveWalk() {
    let node = this.walkStart;
    while (this.grid.walls[node] === 1) {
      const to = this.direction[node];
      this.openCell(node);
      this.connect(node, to);
      node = to;
    }
    for (let i = 0; i < this.mark.length; i++) {
      if (this.mark[i] === MARK_ACTIVE) this.mark[i] = MARK_NONE;
    }
    this.walkLength = 0;
  }

  /** 取一个还没并入迷宫的格子；队列里可能残留已被路径吃掉的，跳过 */
  private takePending(): number {
    while (this.pending.length > 0) {
      const pick = Math.floor(this.random() * this.pending.length);
      const cell = this.pending[pick];
      this.pending[pick] = this.pending[this.pending.length - 1];
      this.pending.pop();
      if (this.grid.walls[cell] === 1) return cell;
    }
    return -1;
  }
}

export function createGenerator(
  algorithm: MazeAlgorithm,
  grid: MazeGrid,
  random: () => number = Math.random
): MazeGenerator {
  switch (algorithm) {
    case 'backtracker':
      return new Backtracker(grid, random);
    case 'prim':
      return new Prim(grid, random);
    case 'kruskal':
      return new Kruskal(grid, random);
    case 'wilson':
      return new Wilson(grid, random);
  }
}

function shuffle<T>(items: T[], random: () => number) {
  for (let i = items.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [items[i], items[j]] = [items[j], items[i]];
  }
}
