import { indexOf, type MazeGrid, xOf, yOf } from '@/lib/maze/grid';

/**
 * 第一人称走迷宫。
 *
 * 和寻路那一页是互补的两面：那边是上帝视角，整张地图随时可查，所以
 * 能用启发式、能从边界里挑全局最优的一格展开；这里只有一个实体，
 * 它只看得见眼前一圈，也不知道出口在哪。
 *
 * 这个区别不止是"信息少一点"。最佳优先搜索展开完这一格，下一格可能
 * 在地图另一头 —— 图搜索里"跳过去"不要钱，实体必须**走过去**。
 * 所以这里的代价是走过的步数（含所有回头路），不是展开数；
 * 四种走法的差距也全体现在这个数上。
 *
 * 方向按顺时针编号，右转就是 +1，掉头是 +2 —— 扶墙法整个就建立在
 * 这个编号上。
 */
export const DIR_UP = 0;
export const DIR_RIGHT = 1;
export const DIR_DOWN = 2;
export const DIR_LEFT = 3;

const DELTAS: [number, number][] = [
  [0, -1],
  [1, 0],
  [0, 1],
  [-1, 0],
];

export type RunnerAlgorithm = 'wall-follower' | 'tremaux' | 'dfs' | 'random';

export interface RunnerStats {
  /** 走过的步数，含回头路 —— 第一人称真正的代价 */
  steps: number;
  /** 踏足过的格子数 */
  visited: number;
  /** 可通行格总数 */
  total: number;
  /** 见过的格子数（踏足过的，加上站在那里能看见的四邻） */
  seen: number;
  done: boolean;
  escaped: boolean;
}

export abstract class MazeRunner {
  readonly grid: MazeGrid;
  readonly start: number;
  readonly goal: number;
  /** 每格被踏过几次。既是 Trémaux 的标记，也是画面上的轨迹热度 */
  readonly visits: Uint16Array;
  /** 见过的格子。没见过的画成雾 —— 这是第一人称的全部要害 */
  readonly seen: Uint8Array;
  readonly total: number;

  at: number;
  facing = DIR_RIGHT;

  protected readonly random: () => number;
  protected steps = 0;
  protected visited = 0;
  protected seenCount = 0;
  protected finished = false;
  protected reached = false;

  constructor(
    grid: MazeGrid,
    start: number,
    goal: number,
    random: () => number
  ) {
    this.grid = grid;
    this.start = start;
    this.goal = goal;
    this.random = random;
    this.visits = new Uint16Array(grid.walls.length);
    this.seen = new Uint8Array(grid.walls.length);

    let total = 0;
    for (let i = 0; i < grid.walls.length; i++) {
      if (grid.walls[i] === 0) total++;
    }
    this.total = total;

    this.at = start;
    this.markVisit(start);
    this.observe(start);
  }

  get done() {
    return this.finished;
  }

  get escaped() {
    return this.reached;
  }

  abstract step(): boolean;

  advance(steps: number): number {
    let taken = 0;
    while (taken < steps && !this.finished) {
      this.step();
      taken++;
    }
    return taken;
  }

  /** 随机游走可能要很久，上限给得宽，纯粹防死循环 */
  runToEnd(limit = 2_000_000) {
    let guard = 0;
    while (!this.finished && guard++ < limit) this.step();
  }

  stats(): RunnerStats {
    return {
      steps: this.steps,
      visited: this.visited,
      total: this.total,
      seen: this.seenCount,
      done: this.finished,
      escaped: this.reached,
    };
  }

  /** 朝某个方向能不能走，能就返回目标格，否则 -1 */
  protected ahead(dir: number): number {
    const x = xOf(this.grid, this.at) + DELTAS[dir][0];
    const y = yOf(this.grid, this.at) + DELTAS[dir][1];
    if (x < 0 || y < 0 || x >= this.grid.cols || y >= this.grid.rows) return -1;
    const index = indexOf(this.grid, x, y);
    return this.grid.walls[index] === 0 ? index : -1;
  }

  /** 收集所有能走的方向 */
  protected options(): { dir: number; index: number }[] {
    const result: { dir: number; index: number }[] = [];
    for (let dir = 0; dir < 4; dir++) {
      const index = this.ahead(dir);
      if (index >= 0) result.push({ dir, index });
    }
    return result;
  }

  protected moveTo(index: number, dir: number) {
    this.facing = dir;
    this.at = index;
    this.steps++;
    this.markVisit(index);
    this.observe(index);
    if (index === this.goal) {
      this.finished = true;
      this.reached = true;
    }
  }

  /** 走投无路 —— 在连通迷宫里不该发生，留着兜底 */
  protected giveUp() {
    this.finished = true;
  }

  private markVisit(index: number) {
    if (this.visits[index] === 0) this.visited++;
    if (this.visits[index] < 0xffff) this.visits[index]++;
  }

  /** 站在一格上，这一格和四邻都算看见了 —— 包括看见"那边是墙" */
  private observe(index: number) {
    this.reveal(index);
    const x = xOf(this.grid, index);
    const y = yOf(this.grid, index);
    for (const [dx, dy] of DELTAS) {
      const nx = x + dx;
      const ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= this.grid.cols || ny >= this.grid.rows) {
        continue;
      }
      this.reveal(indexOf(this.grid, nx, ny));
    }
  }

  private reveal(index: number) {
    if (this.seen[index] === 1) return;
    this.seen[index] = 1;
    this.seenCount++;
  }
}

/**
 * 扶墙法。
 *
 * 一只手始终贴着墙不放，于是优先级永远是：先往扶墙那侧转，转不了就直行，
 * 再不行就转另一侧，最后掉头。它不需要任何记忆 —— 没有地图、没有标记、
 * 连自己走过哪都不知道，只有"我朝哪"。
 *
 * 代价是它只对**单连通**迷宫有效：出口所在的那面墙必须和入口那面墙连着。
 * 一旦出口在迷宫内部的孤岛上，它会沿着外圈绕回原地，永远走不到。
 * 完美迷宫没有环，所以这一页上它总能走出去 —— 但那是迷宫的性质在替它兜底。
 */
class WallFollower extends MazeRunner {
  /** +1 是右手，+3（也就是 -1）是左手 */
  private readonly hand: number;

  constructor(
    grid: MazeGrid,
    start: number,
    goal: number,
    random: () => number,
    hand: number = DIR_RIGHT
  ) {
    super(grid, start, goal, random);
    this.hand = hand;
  }

  step(): boolean {
    if (this.finished) return true;

    const order = [
      (this.facing + this.hand) % 4,
      this.facing,
      (this.facing + 4 - this.hand) % 4,
      (this.facing + 2) % 4,
    ];
    for (const dir of order) {
      const next = this.ahead(dir);
      if (next < 0) continue;
      this.moveTo(next, dir);
      return this.finished;
    }

    this.giveUp();
    return true;
  }
}

/**
 * Trémaux —— 在走过的路上做标记，永远挑标记最少的那条走。
 *
 * 这是最早被证明能解任意迷宫的算法（1882 年），而且只用局部信息：
 * 标记就画在地上，不需要记住地图。有环也不怕，因为绕回来时会看到
 * 自己的标记。代价是要"能在地上做记号"，这比扶墙法多要了一点东西。
 */
class Tremaux extends MazeRunner {
  step(): boolean {
    if (this.finished) return true;

    const options = this.options();
    if (options.length === 0) {
      this.giveUp();
      return true;
    }

    let fewest = Infinity;
    const best: { dir: number; index: number }[] = [];
    for (const option of options) {
      const marks = this.visits[option.index];
      if (marks < fewest) {
        fewest = marks;
        best.length = 0;
      }
      if (marks === fewest) best.push(option);
    }

    const pick = best[Math.floor(this.random() * best.length)];
    this.moveTo(pick.index, pick.dir);
    return this.finished;
  }
}

/**
 * 深度优先探索 + 回溯。
 *
 * 和寻路页那个 DFS 的关键差别：那边"回溯"只是把栈弹一格，不花代价；
 * 这里回溯得**真的原路走回去**，每退一格都记一步。
 * 画面上那条来回蹭亮的路，就是这个代价。
 *
 * 换来的是最强的保证：它系统地探索，不会漏掉任何一格，
 * 也不会像扶墙法那样受迷宫拓扑限制。
 */
class DepthFirst extends MazeRunner {
  private readonly stack: number[] = [];

  constructor(
    grid: MazeGrid,
    start: number,
    goal: number,
    random: () => number
  ) {
    super(grid, start, goal, random);
    this.stack.push(start);
  }

  step(): boolean {
    if (this.finished) return true;

    const fresh = this.options().filter(
      option => this.visits[option.index] === 0
    );
    if (fresh.length > 0) {
      const pick = fresh[Math.floor(this.random() * fresh.length)];
      this.stack.push(pick.index);
      this.moveTo(pick.index, pick.dir);
      return this.finished;
    }

    // 没有新路了，退回上一格 —— 而且是真的走回去
    this.stack.pop();
    const back = this.stack[this.stack.length - 1];
    if (back === undefined) {
      this.giveUp();
      return true;
    }
    this.moveTo(back, directionBetween(this.grid, this.at, back));
    return this.finished;
  }
}

/**
 * 随机游走。反面教材：完全不用记忆也不用规则，每步随便挑一个方向。
 * 它最终一定能走到（连通图上的随机游走以概率 1 覆盖全图），
 * 但期望步数是另外三种的几十倍 —— 这就是"没有策略"的价格。
 */
class RandomWalk extends MazeRunner {
  step(): boolean {
    if (this.finished) return true;

    const options = this.options();
    if (options.length === 0) {
      this.giveUp();
      return true;
    }
    const pick = options[Math.floor(this.random() * options.length)];
    this.moveTo(pick.index, pick.dir);
    return this.finished;
  }
}

export function createRunner(
  algorithm: RunnerAlgorithm,
  grid: MazeGrid,
  start: number,
  goal: number,
  random: () => number = Math.random
): MazeRunner {
  switch (algorithm) {
    case 'wall-follower':
      return new WallFollower(grid, start, goal, random);
    case 'tremaux':
      return new Tremaux(grid, start, goal, random);
    case 'dfs':
      return new DepthFirst(grid, start, goal, random);
    case 'random':
      return new RandomWalk(grid, start, goal, random);
  }
}

function directionBetween(grid: MazeGrid, from: number, to: number): number {
  const dx = Math.sign(xOf(grid, to) - xOf(grid, from));
  const dy = Math.sign(yOf(grid, to) - yOf(grid, from));
  for (let dir = 0; dir < 4; dir++) {
    if (DELTAS[dir][0] === dx && DELTAS[dir][1] === dy) return dir;
  }
  return DIR_RIGHT;
}
