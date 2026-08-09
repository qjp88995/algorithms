import { seededRandom } from '@/lib/random';

import { type Dataset, distance } from './dataset';
import { adjustedRandIndex, clusterCount, inertia } from './metrics';
import type { ClusteringConfig, ClusteringStats } from './types';

/**
 * 三个聚类算法的可单步内核。
 *
 * 它们的分歧不在效率，而在**对「簇」的定义**：
 *
 *   K-means       簇是围着一个中心的球。于是它只能画出直的边界，
 *                 而且必须事先说好要几个。
 *   DBSCAN        簇是连成一片的稠密区域。形状随意，稀疏处判为噪声，
 *                 簇数由数据自己说了算 —— 代价是换成 eps 和 minPts 要调。
 *   层次聚类       先各自成簇，反复合并最近的两个。「最近」怎么定义，
 *                 长出来的簇就完全不同。
 *
 * 谁都没有错，只是各自的假设不一样。换个数据集，赢家就换人 ——
 * 这一页要看的就是这件事。
 *
 * 内核不碰 canvas、不碰 React。
 */
export abstract class ClusterRun {
  readonly data: Dataset;
  readonly config: ClusteringConfig;
  /** 每个点的簇号；-1 表示噪声或者还没定 */
  readonly labels: Int32Array;

  protected steps = 0;
  protected finished = false;

  constructor(data: Dataset, config: ClusteringConfig) {
    this.data = data;
    this.config = config;
    this.labels = new Int32Array(data.truth.length).fill(-1);
  }

  get count() {
    return this.data.truth.length;
  }

  get done() {
    return this.finished;
  }

  abstract step(): boolean;

  advance(steps: number) {
    let taken = 0;
    while (taken < steps && !this.finished) {
      this.step();
      taken++;
    }
    return taken;
  }

  runToEnd() {
    const limit = this.count * this.count + this.count * 4 + 512;
    let guard = 0;
    while (!this.finished && guard++ < limit) this.step();
  }

  stats(): ClusteringStats {
    const pending = this.pendingCount();
    let unlabelled = 0;
    for (const label of this.labels) {
      if (label < 0) unlabelled++;
    }
    return {
      steps: this.steps,
      clusters: clusterCount(this.labels),
      noise: Math.max(0, unlabelled - pending),
      pending,
      agreement: adjustedRandIndex(this.data.truth, this.labels),
      inertia: inertia(this.data, this.labels),
      done: this.finished,
      phase: this.phaseLabel(),
    };
  }

  protected abstract phaseLabel(): string;
  /** 还没被处理到的点数 —— 和「已经判成噪声」是两回事 */
  protected abstract pendingCount(): number;

  protected finish() {
    this.finished = true;
    return true;
  }
}

export function createRun(data: Dataset, config: ClusteringConfig): ClusterRun {
  switch (config.algorithm) {
    case 'kmeans':
      return new KMeansRun(data, config);
    case 'dbscan':
      return new DbscanRun(data, config);
    case 'hierarchical':
      return new HierarchicalRun(data, config);
  }
}

// ─── K-means ────────────────────────────────────────────────
/**
 * Lloyd 迭代：分配、求平均、再分配，直到没人换组。
 *
 * 一步是**半轮** —— 要么重新分配，要么重算中心。分开走是因为这两件事
 * 在画面上完全不同：分配时点在变色，求平均时中心在移动。
 *
 * 它一定会收敛（每一步都不会让簇内平方和变大，而划分只有有限种），
 * 但收敛到的往往只是**局部**最优：初始中心挑得不好，结果就不好，
 * 而且它自己毫无察觉。
 */
export class KMeansRun extends ClusterRun {
  /** 交错存储的中心坐标 */
  readonly centers: Float64Array;
  /** 每个中心一路移动过来的轨迹，画布拿它画尾巴 */
  readonly trails: number[][];
  readonly k: number;

  /** 分配阶段正在处理的点，画布拿它画一条指向所属中心的线 */
  cursor = -1;

  private stage: 'assign' | 'update' = 'assign';
  private iteration = 0;
  private at = 0;
  private changed = 0;
  private firstPass = true;

  constructor(data: Dataset, config: ClusteringConfig) {
    super(data, config);
    this.k = Math.max(1, Math.min(config.k, this.count));
    const random = seededRandom(config.initSeed * 977 + 41);
    const seeds = config.smartInit
      ? plusPlusSeeds(data, this.k, random)
      : forgySeeds(this.count, this.k, random);

    this.centers = new Float64Array(this.k * 2);
    this.trails = [];
    seeds.forEach((point, index) => {
      const x = data.points[point * 2];
      const y = data.points[point * 2 + 1];
      this.centers[index * 2] = x;
      this.centers[index * 2 + 1] = y;
      this.trails.push([x, y]);
    });
  }

  step(): boolean {
    if (this.finished) return true;
    this.steps++;
    if (this.stage === 'assign') {
      this.assignOne();
    } else {
      this.update();
      this.stage = 'assign';
      this.at = 0;
      this.changed = 0;
    }
    return this.finished;
  }

  /**
   * 一步只处理一个点：让它认领离自己最近的那个中心。
   *
   * 整轮一次算完在画面上是一闪而过 —— 而这一页要看的恰恰是边界
   * 附近那些点在两个中心之间反复横跳。所以分配拆成一点一步。
   */
  private assignOne() {
    const point = this.at++;
    this.cursor = point;

    let best = 0;
    let bestDist = Infinity;
    for (let center = 0; center < this.k; center++) {
      const dx = this.data.points[point * 2] - this.centers[center * 2];
      const dy = this.data.points[point * 2 + 1] - this.centers[center * 2 + 1];
      const value = dx * dx + dy * dy;
      if (value < bestDist) {
        bestDist = value;
        best = center;
      }
    }
    if (this.labels[point] !== best) this.changed++;
    this.labels[point] = best;

    if (this.at < this.count) return;

    this.cursor = -1;
    this.firstPass = false;
    this.stage = 'update';
    // 一整轮下来没有一个点换组，就再也不会有变化了
    if (this.changed === 0) this.finish();
  }

  /** 中心挪到自己那群点的重心上 */
  private update() {
    const sums = new Float64Array(this.k * 2);
    const counts = new Int32Array(this.k);
    for (let point = 0; point < this.count; point++) {
      const label = this.labels[point];
      if (label < 0) continue;
      sums[label * 2] += this.data.points[point * 2];
      sums[label * 2 + 1] += this.data.points[point * 2 + 1];
      counts[label]++;
    }
    for (let center = 0; center < this.k; center++) {
      // 一个点都没认领的中心留在原地 —— 它下一轮还有机会被人认领
      if (counts[center] === 0) continue;
      this.centers[center * 2] = sums[center * 2] / counts[center];
      this.centers[center * 2 + 1] = sums[center * 2 + 1] / counts[center];
      this.trails[center].push(
        this.centers[center * 2],
        this.centers[center * 2 + 1]
      );
    }
    this.iteration++;
  }

  protected phaseLabel() {
    if (this.finished) return `第 ${this.iteration} 轮 · 收敛`;
    const action = this.stage === 'assign' ? '分配点' : '移动中心';
    return `第 ${this.iteration + 1} 轮 · ${action}`;
  }

  protected pendingCount() {
    return this.firstPass ? this.count - this.at : 0;
  }
}

/** 随手抓 K 个互不相同的点 */
function forgySeeds(count: number, k: number, random: () => number): number[] {
  const chosen = new Set<number>();
  while (chosen.size < k) chosen.add(Math.floor(random() * count));
  return [...chosen];
}

/**
 * K-means++：第一个中心随便挑，之后每个中心按「离已有中心多远」
 * 的平方加权抽 —— 中心被撒得开，落进同一个团里的概率就低多了。
 *
 * 它只改初始化，一行迭代都没动，却把「运气不好就分错」压下去一大截。
 */
function plusPlusSeeds(
  data: Dataset,
  k: number,
  random: () => number
): number[] {
  const count = data.truth.length;
  const chosen = [Math.floor(random() * count)];
  const best = new Float64Array(count).fill(Infinity);

  while (chosen.length < k) {
    const last = chosen[chosen.length - 1];
    let total = 0;
    for (let point = 0; point < count; point++) {
      const d = distance(data, point, last);
      best[point] = Math.min(best[point], d * d);
      total += best[point];
    }
    if (total <= 0) break;

    let target = random() * total;
    let picked = count - 1;
    for (let point = 0; point < count; point++) {
      target -= best[point];
      if (target <= 0) {
        picked = point;
        break;
      }
    }
    if (chosen.includes(picked)) {
      // 极小概率抽中重复的，退化成随便找一个没被选过的
      const fallback = [...Array(count).keys()].find(p => !chosen.includes(p));
      if (fallback === undefined) break;
      chosen.push(fallback);
    } else {
      chosen.push(picked);
    }
  }
  return chosen;
}

// ─── DBSCAN ─────────────────────────────────────────────────
/**
 * 密度聚类。
 *
 * 只问两件事：多近算「挨着」（eps），多少个邻居算「稠密」（minPts）。
 * 稠密的点叫核心点，核心点之间只要挨着就连成一片；挨着核心点但自己
 * 不稠密的是边界点；剩下的是噪声。
 *
 * 一步 = 处理一个点：查一次它的邻域，然后决定开新簇、并进当前簇、
 * 还是判为噪声。它不需要预先知道簇数，也不介意簇是什么形状 ——
 * 这两件事恰好都是 K-means 做不到的。
 */
export class DbscanRun extends ClusterRun {
  /** 邻居数达标的点 */
  readonly core: Uint8Array;
  readonly visited: Uint8Array;
  /** 这一拍在看哪个点；-1 表示没有 */
  cursor = -1;
  /** 它的 eps 邻域，画布拿它画那个圈 */
  neighborhood: number[] = [];

  private queue: number[] = [];
  private queueHead = 0;
  /** 已经排过队的点。种子集合是**集合**，同一个点不该排两次队 */
  private readonly queued: Uint8Array;
  private scan = 0;
  private cluster = -1;

  constructor(data: Dataset, config: ClusteringConfig) {
    super(data, config);
    this.core = new Uint8Array(this.count);
    this.visited = new Uint8Array(this.count);
    this.queued = new Uint8Array(this.count);
  }

  step(): boolean {
    if (this.finished) return true;
    this.steps++;

    // 手上还有没扩展完的簇，就先把它扩完
    if (this.queueHead < this.queue.length) {
      this.expand();
      return false;
    }

    while (this.scan < this.count && this.visited[this.scan]) this.scan++;
    if (this.scan >= this.count) {
      this.cursor = -1;
      this.neighborhood = [];
      return this.finish();
    }
    this.startAt(this.scan);
    return false;
  }

  /** 从一个没访问过的点起头：够稠密就开一个新簇，否则先记成噪声 */
  private startAt(point: number) {
    this.visited[point] = 1;
    this.cursor = point;
    const near = this.regionQuery(point);
    this.neighborhood = near;

    if (near.length < this.config.minPts) {
      // 只是"暂时"的噪声 —— 它之后可能被某个核心点收编成边界点
      this.labels[point] = -1;
      return;
    }

    this.cluster++;
    this.core[point] = 1;
    this.labels[point] = this.cluster;
    this.queued.fill(0);
    this.queued[point] = 1;
    this.queue = [];
    this.queueHead = 0;
    for (const other of near) this.enqueue(other);
  }

  private enqueue(point: number) {
    if (this.queued[point]) return;
    this.queued[point] = 1;
    this.queue.push(point);
  }

  private expand() {
    const point = this.queue[this.queueHead++];
    this.cursor = point;

    if (!this.visited[point]) {
      this.visited[point] = 1;
      const near = this.regionQuery(point);
      this.neighborhood = near;
      // 自己也稠密，那它的邻居也都属于这个簇 —— 簇就是这样一路蔓延的
      if (near.length >= this.config.minPts) {
        this.core[point] = 1;
        for (const other of near) this.enqueue(other);
      }
    } else {
      this.neighborhood = [];
    }

    // 还没归属的点（包括之前被判为噪声的）收进当前簇，成为边界点
    if (this.labels[point] < 0) this.labels[point] = this.cluster;
  }

  /** eps 半径内的所有点，含自己。暴力扫一遍 —— 这一页的点数吃得消 */
  private regionQuery(point: number): number[] {
    const near: number[] = [];
    for (let other = 0; other < this.count; other++) {
      if (distance(this.data, point, other) <= this.config.eps) {
        near.push(other);
      }
    }
    return near;
  }

  protected phaseLabel() {
    if (this.finished) return '扫描完毕';
    return this.queueHead < this.queue.length ? '扩展当前簇' : '找下一个种子';
  }

  protected pendingCount() {
    let pending = 0;
    for (const seen of this.visited) {
      if (!seen) pending++;
    }
    return pending;
  }
}

// ─── 层次聚类 ────────────────────────────────────────────────
interface Merge {
  ax: number;
  ay: number;
  bx: number;
  by: number;
  distance: number;
}

/**
 * 凝聚式层次聚类。
 *
 * 每个点先自成一簇，每一步合并当前最近的两个簇，直到剩下 K 个。
 * 「两个簇有多近」有好几种算法，而这个选择直接决定长出什么形状：
 *
 *   单连接 single    取两簇之间**最近**的一对点。链式效应：一串挨得近的
 *                    点会把两个大团串起来，好处是能追出细长的形状。
 *   全连接 complete  取**最远**的一对点。偏爱紧凑的球形簇，抗链式效应。
 *   平均连接 average 取所有点对的平均，介于两者之间。
 *
 * 合并本身用 Lance-Williams 递推：新簇到别人的距离，直接从两个旧簇
 * 的距离算出来，不必回头再看点。
 */
export class HierarchicalRun extends ClusterRun {
  /** 已经发生过的合并，画布拿它画连线 */
  readonly merges: Merge[] = [];
  /** 刚合并的那一对簇里的代表点 */
  lastPair: [number, number] | null = null;

  private readonly active: Uint8Array;
  private readonly size: Int32Array;
  /** 簇里最小的那个点下标 —— 重新编号时按它排序，颜色才不会乱跳 */
  private readonly smallest: Int32Array;
  private readonly members: number[][];
  private readonly dist: Float64Array;
  private clusters: number;
  private readonly target: number;

  constructor(data: Dataset, config: ClusteringConfig) {
    super(data, config);
    const n = this.count;
    this.active = new Uint8Array(n).fill(1);
    this.size = new Int32Array(n).fill(1);
    this.smallest = new Int32Array(n).map((_, index) => index);
    this.members = Array.from({ length: n }, (_, index) => [index]);
    this.dist = new Float64Array(n * n);
    this.clusters = n;
    this.target = Math.max(1, Math.min(config.k, n));

    for (let a = 0; a < n; a++) {
      for (let b = a + 1; b < n; b++) {
        const value = distance(data, a, b);
        this.dist[a * n + b] = value;
        this.dist[b * n + a] = value;
      }
    }
    this.relabel();
  }

  step(): boolean {
    if (this.finished) return true;
    if (this.clusters <= this.target) return this.finish();
    this.steps++;

    const pair = this.closestPair();
    if (!pair) return this.finish();

    const [a, b, gap] = pair;
    this.recordMerge(a, b, gap);
    this.mergeInto(a, b);
    this.relabel();

    if (this.clusters <= this.target) return this.finish();
    return false;
  }

  /** 扫一遍所有还活着的簇对，挑最近的那一对 */
  private closestPair(): [number, number, number] | null {
    const n = this.count;
    let best: [number, number, number] | null = null;
    for (let a = 0; a < n; a++) {
      if (!this.active[a]) continue;
      for (let b = a + 1; b < n; b++) {
        if (!this.active[b]) continue;
        const gap = this.dist[a * n + b];
        if (!best || gap < best[2]) best = [a, b, gap];
      }
    }
    return best;
  }

  private recordMerge(a: number, b: number, gap: number) {
    const [ax, ay] = this.centroid(a);
    const [bx, by] = this.centroid(b);
    this.merges.push({ ax, ay, bx, by, distance: gap });
    this.lastPair = [this.members[a][0], this.members[b][0]];
  }

  /** 把 b 并进 a，并按 linkage 更新 a 到其余簇的距离 */
  private mergeInto(a: number, b: number) {
    const n = this.count;
    const sizeA = this.size[a];
    const sizeB = this.size[b];

    for (let other = 0; other < n; other++) {
      if (!this.active[other] || other === a || other === b) continue;
      const da = this.dist[a * n + other];
      const db = this.dist[b * n + other];
      const merged =
        this.config.linkage === 'single'
          ? Math.min(da, db)
          : this.config.linkage === 'complete'
            ? Math.max(da, db)
            : (da * sizeA + db * sizeB) / (sizeA + sizeB);
      this.dist[a * n + other] = merged;
      this.dist[other * n + a] = merged;
    }

    this.members[a] = this.members[a].concat(this.members[b]);
    this.members[b] = [];
    this.size[a] = sizeA + sizeB;
    this.smallest[a] = Math.min(this.smallest[a], this.smallest[b]);
    this.active[b] = 0;
    this.clusters--;
  }

  private centroid(cluster: number): [number, number] {
    let x = 0;
    let y = 0;
    for (const point of this.members[cluster]) {
      x += this.data.points[point * 2];
      y += this.data.points[point * 2 + 1];
    }
    const n = Math.max(1, this.members[cluster].length);
    return [x / n, y / n];
  }

  /**
   * 给活跃的簇重新编号。
   *
   * 按簇里最小的那个点下标排序 —— 两簇合并时编号小的那个留住自己的
   * 颜色，另一半跟着变。要是直接拿簇的内部下标当颜色，每合并一次
   * 满屏的颜色都会重排，看着像整个重算了一遍。
   */
  private relabel() {
    const order = [];
    for (let cluster = 0; cluster < this.count; cluster++) {
      if (!this.active[cluster] || this.members[cluster].length === 0) continue;
      order.push(cluster);
    }
    order.sort((a, b) => this.smallest[a] - this.smallest[b]);
    order.forEach((cluster, label) => {
      for (const point of this.members[cluster]) this.labels[point] = label;
    });
  }

  protected phaseLabel() {
    if (this.finished) return `合并到 ${this.clusters} 个簇`;
    return `还剩 ${this.clusters} 个簇`;
  }

  protected pendingCount() {
    return 0;
  }
}
