import { SAND } from './materials';
import type { SandConfig } from './types';

/**
 * 一进来是一个沙漏：一堆沙、一个石头做的漏斗、一块空地。
 *
 * 挑它当开场是因为它一眼就把这一页的论点摆出来了 —— 沙会流、会在颈口
 * 卡成拱、会在底下堆成一个自然的锥。这些形状没有一个是写出来的，
 * 全是「先看正下方，再看左下右下」这三句话的副产品。
 */
export const defaultConfig: SandConfig = {
  cellSize: 3,
  speed: 60,
  brushSize: 4,
  material: SAND,
  showChunks: false,
  useChunks: true,
  alternateScan: true,
  bottomUp: true,
  liquidSpread: 5,
};

export const INITIAL_SCENE = 'hourglass';

export const MIN_CELL_SIZE = 2;
export const MAX_CELL_SIZE = 8;

export const MIN_BRUSH = 0;
export const MAX_BRUSH = 24;

/** 每秒步数。60 = 满速（每帧一步），调到个位数就是慢动作 */
export const MIN_SPEED = 2;
export const MAX_SPEED = 240;
/** 掉帧或标签页切回来时最多补几步，免得一下冲过去一大段 */
export const MAX_STEPS_PER_FRAME = 4;

export const MIN_SPREAD = 1;
export const MAX_SPREAD = 8;

/**
 * 网格规模上限。cellSize 拉到 2 时一屏能有三十多万格，
 * 而这套模拟是单线程 JS —— 到这个量级已经掉到 30 帧上下了。
 * Noita 靠的是 C++ 加棋盘着色多线程，这里没有那张牌可打。
 */
export const MAX_CELLS = 260_000;

/**
 * 画布上除材质之外的颜色。
 *
 * 材质自己的颜色在 `materials.ts` 里 —— 那是模拟的一部分；
 * 这里几个是「讲解用的图层」：块边框、笔刷光标。
 */
export const sandColors = {
  background: '#0d1017',
  /** 本帧真的被扫过的块 */
  chunkActive: '#2dd4bf',
  /** 睡着的块 */
  chunkIdle: '#1c2330',
  brush: '#e8eef6',
} as const;
