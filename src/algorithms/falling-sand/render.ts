import { sandColors } from './constants';
import { EMPTY, LIFE_MAX, MATERIAL_COUNT, MATERIALS } from './materials';
import { CHUNK, type SandWorld } from './sand';

/**
 * canvas 绘制层。
 *
 * 和元胞自动机页同一套路：**先写一张一格一像素的小图，再整体放大**。
 * 这里更非做不可 —— 一屏是十几万格而不是两三万，逐格 `fillRect` 光是
 * 换 fillStyle 就能把帧率吃干净。
 *
 * 颜色全部预生成成查找表，每格只做一次数组下标：
 *
 * - 普通材质按 `tint` 取 32 级亮度。这一格的 tint 是它出生时掷的，
 *   搬家时跟着一起走 —— 沙子的颗粒感来自这里，而「跟着走」是关键：
 *   要是每帧现掷，整片沙会像电视雪花一样闪。
 * - 火 / 烟 / 蒸汽按**剩余寿命**取色，于是火焰自己会由亮黄烧到暗红，
 *   烟会一路淡进背景。不需要任何粒子系统。
 */

const TINT_STEPS = 32;

function hexToRgb(hex: string): [number, number, number] {
  const value = Number.parseInt(hex.slice(1), 16);
  return [(value >> 16) & 255, (value >> 8) & 255, value & 255];
}

/** 小端序下 ImageData 一个像素的 32 位写法 */
function pack(r: number, g: number, b: number) {
  return (255 << 24) | (b << 16) | (g << 8) | r;
}

function clamp255(value: number) {
  return value < 0 ? 0 : value > 255 ? 255 : Math.round(value);
}

const TINT_RAMP = new Uint32Array(MATERIAL_COUNT * TINT_STEPS);
const LIFE_RAMP = new Uint32Array(MATERIAL_COUNT * TINT_STEPS);
const HAS_FADE = new Uint8Array(MATERIAL_COUNT);
/** 把剩余寿命换算成 0~31 的下标，热路径上只剩一次乘法 */
const LIFE_SCALE = new Float32Array(MATERIAL_COUNT);

for (const material of MATERIALS) {
  const [r, g, b] = hexToRgb(material.color);
  const base = material.id * TINT_STEPS;

  for (let step = 0; step < TINT_STEPS; step++) {
    const t = step / (TINT_STEPS - 1);
    const factor = 1 + (t - 0.5) * 2 * material.jitter;
    TINT_RAMP[base + step] = pack(
      clamp255(r * factor),
      clamp255(g * factor),
      clamp255(b * factor)
    );
  }

  if (!material.fadeColor) continue;
  HAS_FADE[material.id] = 1;
  LIFE_SCALE[material.id] = (TINT_STEPS - 1) / LIFE_MAX[material.id];
  const [fr, fg, fb] = hexToRgb(material.fadeColor);
  for (let step = 0; step < TINT_STEPS; step++) {
    // 下标 0 是「快没了」，31 是「刚出生」
    const t = step / (TINT_STEPS - 1);
    LIFE_RAMP[base + step] = pack(
      clamp255(fr + (r - fr) * t),
      clamp255(fg + (g - fg) * t),
      clamp255(fb + (b - fb) * t)
    );
  }
}

const BACKGROUND = pack(...hexToRgb(sandColors.background));

export interface SandView {
  width: number;
  height: number;
  cellSize: number;
  showChunks: boolean;
  /** 笔刷光标，单位是格 */
  brush: { x: number; y: number; radius: number } | null;
}

export class SandRenderer {
  private readonly buffer = document.createElement('canvas');
  private readonly bufferCtx = this.buffer.getContext('2d', {
    willReadFrequently: false,
  })!;
  private image: ImageData | null = null;
  private pixels: Uint32Array | null = null;

  private ensure(cols: number, rows: number) {
    if (this.buffer.width !== cols || this.buffer.height !== rows) {
      this.buffer.width = cols;
      this.buffer.height = rows;
      this.image = this.bufferCtx.createImageData(cols, rows);
      this.pixels = new Uint32Array(this.image.data.buffer);
    }
    return this.pixels!;
  }

  draw(ctx: CanvasRenderingContext2D, world: SandWorld, view: SandView) {
    const { cols, rows, mat, tint, life } = world;
    const pixels = this.ensure(cols, rows);

    for (let i = 0; i < mat.length; i++) {
      const id = mat[i];
      if (id === EMPTY) {
        pixels[i] = BACKGROUND;
      } else if (HAS_FADE[id]) {
        const step = (life[i] * LIFE_SCALE[id]) | 0;
        pixels[i] = LIFE_RAMP[id * TINT_STEPS + (step > 31 ? 31 : step)];
      } else {
        pixels[i] = TINT_RAMP[id * TINT_STEPS + (tint[i] >> 3)];
      }
    }

    this.bufferCtx.putImageData(this.image!, 0, 0);
    ctx.fillStyle = sandColors.background;
    ctx.fillRect(0, 0, view.width, view.height);
    // 关掉插值，放大之后像素边缘才是硬的
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(
      this.buffer,
      0,
      0,
      cols,
      rows,
      0,
      0,
      cols * view.cellSize,
      rows * view.cellSize
    );
    ctx.imageSmoothingEnabled = true;

    if (view.showChunks) drawChunks(ctx, world, view.cellSize);
    if (view.brush) drawBrush(ctx, view.brush, view.cellSize);
  }
}

/**
 * 把「这一帧到底算了哪几块」直接画出来。
 *
 * 亮边框是本帧真被扫过的块，暗边框是睡着的。一屏静止的沙堆跑起来
 * 通常只剩十几个亮块 —— 这条信息平时完全看不见，而它正是这套模拟
 * 能在浏览器里跑十几万格的原因。
 */
function drawChunks(
  ctx: CanvasRenderingContext2D,
  world: SandWorld,
  cellSize: number
) {
  const size = CHUNK * cellSize;
  const { chunkCols, chunkRows, chunkActive } = world;

  ctx.save();
  ctx.lineWidth = 1;

  ctx.strokeStyle = sandColors.chunkIdle;
  ctx.beginPath();
  for (let cy = 0; cy < chunkRows; cy++) {
    for (let cx = 0; cx < chunkCols; cx++) {
      if (chunkActive[cy * chunkCols + cx]) continue;
      // 半像素偏移，1px 的线才不会被抹成两像素灰边
      ctx.rect(cx * size + 0.5, cy * size + 0.5, size - 1, size - 1);
    }
  }
  ctx.stroke();

  ctx.strokeStyle = sandColors.chunkActive;
  ctx.globalAlpha = 0.9;
  ctx.beginPath();
  for (let cy = 0; cy < chunkRows; cy++) {
    for (let cx = 0; cx < chunkCols; cx++) {
      if (!chunkActive[cy * chunkCols + cx]) continue;
      ctx.rect(cx * size + 0.5, cy * size + 0.5, size - 1, size - 1);
    }
  }
  ctx.stroke();
  ctx.restore();
}

function drawBrush(
  ctx: CanvasRenderingContext2D,
  brush: NonNullable<SandView['brush']>,
  cellSize: number
) {
  ctx.save();
  ctx.strokeStyle = sandColors.brush;
  ctx.globalAlpha = 0.5;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.arc(
    (brush.x + 0.5) * cellSize,
    (brush.y + 0.5) * cellSize,
    Math.max(cellSize * 0.75, (brush.radius + 0.5) * cellSize),
    0,
    Math.PI * 2
  );
  ctx.stroke();
  ctx.restore();
}
