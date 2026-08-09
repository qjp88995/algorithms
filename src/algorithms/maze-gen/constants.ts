import type { MazeAlgorithm } from '@/lib/maze/generators';

/** 通道格落在奇数坐标，所以列数取奇数，最右一列才不会剩半堵墙 */
export const DEFAULT_COLS = 41;
export const MIN_COLS = 15;
export const MAX_COLS = 61;

/** 画布接近 16:10，行数按这个比例推出来再取奇数 */
export function rowsFor(cols: number) {
  const rows = Math.round(cols * 0.62);
  return rows % 2 === 0 ? rows + 1 : rows;
}

/** 每帧执行多少步。Wilson 的步子很碎，默认给得比寻路快 */
export const DEFAULT_SPEED = 8;

/** 对比模式下并排跑的四种生成算法 */
export const comparedAlgorithms: MazeAlgorithm[] = [
  'backtracker',
  'prim',
  'kruskal',
  'wilson',
];

export const algorithmLabels: Record<
  MazeAlgorithm,
  { label: string; enName: string; key: string; blurb: string }
> = {
  backtracker: {
    label: '递归回溯',
    enName: 'Recursive Backtracker',
    key: '栈',
    blurb:
      '一条蛇一直往前钻，钻不动才退回最近的岔口。走廊细长、拐弯多，最像人手画的迷宫。',
  },
  prim: {
    label: '随机 Prim',
    enName: 'Randomised Prim',
    key: '边界集合',
    blurb:
      '每次从整圈边界里随机挑一格并入，于是从种子向四周均匀蔓延。岔口密、死胡同多。',
  },
  kruskal: {
    label: '随机 Kruskal',
    enName: 'Randomised Kruskal',
    key: '并查集',
    blurb:
      '满地孤立房间，把墙打乱后逐堵拆：两边不连通就拆。唯一能直接看见连通块合并的一种。',
  },
  wilson: {
    label: 'Wilson',
    enName: 'Loop-Erased Random Walk',
    key: '随机游走',
    blurb:
      '瞎走，走出环就把环抹掉，撞上迷宫才定型。慢一个数量级，换来的是真正的均匀随机。',
  },
};

// ─── 绘制 ─────────────────────────────────────────────────────
export const mazeColors = {
  background: '#181c24',
  /** 还没打通的墙 */
  wall: '#232936',
  /** 已并入迷宫的通道 */
  cell: '#4a5670',
  /** 活跃集合：栈上 / 边界里 / 正被游走 */
  active: '#5ad1c8',
  /** 正在操作的那一格 */
  cursor: '#ffffff',
} as const;

/**
 * Kruskal 的连通块配色。用黄金角散开色相，相邻的编号也不会撞色；
 * 饱和度压低一点，四块画布并排时才不至于花。
 */
export function componentColor(root: number) {
  const hue = Math.round((root * 137.508) % 360);
  return `hsl(${hue} 42% 52%)`;
}

/** 图例里用来示意"分块"的一条彩虹 */
export const componentSwatch = `linear-gradient(90deg, ${componentColor(1)}, ${componentColor(2)}, ${componentColor(3)}, ${componentColor(4)})`;
