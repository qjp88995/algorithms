import type { RunnerAlgorithm } from './runner';

export const DEFAULT_COLS = 31;
export const MIN_COLS = 15;
export const MAX_COLS = 61;

/** 通道格落在奇数坐标，列数取奇数 */
export function rowsFor(cols: number) {
  const rows = Math.round(cols * 0.62);
  return rows % 2 === 0 ? rows + 1 : rows;
}

/** 每帧走多少步。随机游走动辄上万步，默认给得快一些 */
export const DEFAULT_SPEED = 6;

export const comparedAlgorithms: RunnerAlgorithm[] = [
  'wall-follower',
  'tremaux',
  'dfs',
  'random',
];

export const algorithmLabels: Record<
  RunnerAlgorithm,
  { label: string; enName: string; key: string; blurb: string }
> = {
  'wall-follower': {
    label: '扶墙法',
    enName: 'Wall Follower',
    key: '只记朝向',
    blurb:
      '一只手贴着墙不放。不需要任何记忆，代价是只对单连通迷宫有效 —— 出口在内部孤岛上时它会绕回原地。',
  },
  tremaux: {
    label: 'Trémaux',
    enName: 'Trémaux',
    key: '地上做标记',
    blurb:
      '在走过的路上留标记，永远挑标记最少的走。1882 年就被证明能解任意迷宫，而且标记画在地上，不用记地图。',
  },
  dfs: {
    label: '深度优先 + 回溯',
    enName: 'DFS with Backtracking',
    key: '记住整张图',
    blurb:
      '系统地钻到底再退回来。保证最强，但回溯得原路走回去 —— 图搜索里免费的那一下，在这里是要走路的。',
  },
  random: {
    label: '随机游走',
    enName: 'Random Walk',
    key: '什么都不记',
    blurb:
      '每步随便挑个方向。最终一定能走到，但期望步数是另外三种的几十倍。这就是没有策略的价格。',
  },
};

// ─── 绘制 ─────────────────────────────────────────────────────
export const runnerColors = {
  background: '#12151c',
  /** 还没见过的地方 */
  fog: '#171b23',
  /** 见过的墙 */
  wall: '#39414f',
  /** 见过但没踏足的通道 */
  cell: '#1e232d',
  /** 踏足过一次 */
  trailFrom: '#33507a',
  /** 反复踏过 —— 越红说明白走得越多 */
  trailTo: '#d1663c',
  /** 走迷宫的实体 */
  runner: '#ffe27a',
  start: '#5ad1c8',
  goal: '#f97362',
} as const;

/** 轨迹热度封顶：再多也不会更红，否则随机游走会把整张图烧成一片 */
export const TRAIL_CAP = 6;

export const trailSwatch = `linear-gradient(90deg, ${runnerColors.trailFrom}, ${runnerColors.trailTo})`;
