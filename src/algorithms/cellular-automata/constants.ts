import { parseRule } from './life';
import type { CellularConfig } from './types';

/**
 * 一进来就是生命游戏配滑翔机枪 —— 这一页最该看的一幕：
 * 一行字符能写完的规则，造出一台永远吐飞船的机器。
 *
 * 默认边界是**有界**而不是环形，这是被演示效果逼的：卷成甜甜圈之后，
 * 吐出去的滑翔机四百多代就绕回来把枪自己打烂，画面变成一锅混沌汤。
 * 有界画布上它们撞墙解体，枪能一直稳稳地跑下去。
 * 代价是人口不再无上界 —— 那一节说明里专门讲了这笔账。
 */
export const defaultConfig: CellularConfig = {
  dimension: '2d',
  rule: parseRule('B3/S23'),
  ruleNumber: 30,
  edge: 'bounded',
  seed: 'single',
  density: 0.3,
  cellSize: 7,
  speed: 20,
  ageColoring: true,
  decayTrails: true,
  showGrid: false,
};

/** 进页面自动摆上的图案，以及它落在哪 —— 「重置」也回到这里 */
export const INITIAL_PATTERN = 'gosper-gun';
export const INITIAL_PATTERN_AT = { x: 2, y: 2 };

export const MIN_CELL_SIZE = 3;
export const MAX_CELL_SIZE = 16;
/** 低于这个格子边长就不画网格线了，否则整屏都是线 */
export const GRID_LINE_MIN_CELL = 6;

export const MIN_SPEED = 1;
export const MAX_SPEED = 60;

export const MIN_DENSITY = 0.02;
export const MAX_DENSITY = 0.6;

/** 周期检测的观察窗口：只认得出这么长以内的循环 */
export const CYCLE_WINDOW = 64;

/**
 * 八条 Life-like 规则。
 *
 * 它们跑的是同一个内核、同一个循环，差别只有那两个九位掩码。
 * 挑这八条是为了把「规则空间」摊开：有恰好平衡的、有只烧不留的、
 * 有只长不死的、有黑白对称的 —— 生命游戏并不特殊，它只是好看。
 */
export const rulePresets = [
  {
    id: 'life',
    label: '生命游戏',
    notation: 'B3/S23',
    blurb:
      'Conway 挑了很久才定下的一组数：再松一点就爆炸，再紧一点就全灭。它卡在两者中间。',
  },
  {
    id: 'highlife',
    label: 'HighLife',
    notation: 'B36/S23',
    blurb: '只多加了一条「六个邻居也能生」，就多出一个会自我复制的图案。',
  },
  {
    id: 'seeds',
    label: 'Seeds',
    notation: 'B2/S',
    blurb: '存活条件是空的 —— 没有一个细胞能活过一代，整片却烧得满屏都是。',
  },
  {
    id: 'day-night',
    label: '昼夜',
    notation: 'B3678/S34678',
    blurb: '死活对调之后规则不变。于是黑的图案和白的图案长得一样好。',
  },
  {
    id: 'maze',
    label: '迷宫',
    notation: 'B3/S12345',
    blurb: '长出走廊和死胡同。和迷宫生成页那棵生成树是完全不同的造法。',
  },
  {
    id: 'coral',
    label: '珊瑚',
    notation: 'B3/S45678',
    blurb: '边缘慢慢结晶，内部一旦成型就再也不动。活跃度会一路掉到接近 0。',
  },
  {
    id: 'replicator',
    label: '复制者',
    notation: 'B1357/S1357',
    blurb: '放什么它复制什么，副本再复制副本 —— 长出谢尔宾斯基式的分形。',
  },
  {
    id: 'no-death',
    label: '不死',
    notation: 'B3/S012345678',
    blurb: '只生不死，人口单调不减。最后要么填满，要么卡在一个静止的图上。',
  },
] as const;

/**
 * 五条初等 CA。
 *
 * 顺序按 Wolfram 的四类行为排：先均一、再周期、再混沌、最后复杂。
 * 都从正中央一个活细胞出发 —— 同样的初值、同样的八位规则，
 * 输出的复杂度差了几个量级。
 */
export const elementaryPresets = [
  {
    rule: 250,
    label: 'Rule 250',
    className: '二类 · 周期',
    blurb: '规整到无聊：一个细胞长成一个空心三角，此外什么都不会发生。',
  },
  {
    rule: 90,
    label: 'Rule 90',
    className: '三类 · 分形',
    blurb:
      '下一格 = 左邻居 异或 右邻居。就这一句话，长出谢尔宾斯基三角，每一层都自相似。',
  },
  {
    rule: 30,
    label: 'Rule 30',
    className: '三类 · 混沌',
    blurb:
      '左半边规整，右半边彻底混沌。它的中间那一列曾被 Mathematica 当作随机数源。',
  },
  {
    rule: 110,
    label: 'Rule 110',
    className: '四类 · 复杂',
    blurb:
      '规整的背景上爬着一群会互相碰撞的结构。它已被证明图灵完备 —— 八个二进制位，什么都能算。',
  },
  {
    rule: 184,
    label: 'Rule 184',
    className: '交通流',
    blurb:
      '把 1 读成车：前面空着就往前开。密度过半就再也开不动 —— 堵车是规则自己长出来的。',
  },
] as const;

// ─── 绘制 ─────────────────────────────────────────────────────

/**
 * 画布配色。
 *
 * 年龄用一条青 → 蓝 → 靛的渐变：刚出生的最亮，活得久的沉下去。
 * 这样静止物会「暗掉」，运动的边缘一直发亮 —— 一眼就能把满屏的
 * 死水和真正在动的地方分开，这是单色画法给不了的。
 */
export const cellColors = {
  background: '#12151c',
  grid: '#1d2331',
  /** 刚出生的细胞 */
  young: '#a8fff0',
  /** 活了十几代 */
  mid: '#4fb8f0',
  /** 一直没动过的老细胞 */
  old: '#3a4d95',
  /** 刚死掉的余晖 */
  decay: '#2b3550',
  /** 关掉年龄着色时的统一色 */
  plain: '#7fe3d0',
  /** 一维时空图里最新生成的那一行 */
  latest: '#ffd479',
  /** 图案落点预览 */
  ghost: '#f0c05a',
} as const;

/** 年龄渐变的分段：`[年龄, 颜色]`，中间线性插值 */
export const ageStops: [number, string][] = [
  [1, cellColors.young],
  [16, cellColors.mid],
  [120, cellColors.old],
];
