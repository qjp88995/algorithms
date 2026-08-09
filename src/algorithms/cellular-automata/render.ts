import { ageStops, cellColors } from './constants';
import type { ElementaryCA } from './elementary';
import { DECAY_FRAMES, type LifeGrid } from './life';
import { patternSize } from './patterns';
import type { Pattern } from './types';

/**
 * canvas 绘制层。
 *
 * 关键选择：**先画一张一格一像素的图，再整体放大**。
 * 直接 `fillRect` 每个格子的话，满屏两三万格、每格还要按年龄换一次
 * fillStyle，状态切换本身就压掉一半帧率。写 `ImageData` 是纯内存操作，
 * 放大交给 `drawImage` 一次搞定，关掉插值后边缘还是硬的。
 */

export interface LifeView {
  width: number;
  height: number;
  cellSize: number;
  ageColoring: boolean;
  decayTrails: boolean;
  showGrid: boolean;
  /** 鼠标底下待放置的图案 */
  ghost: { pattern: Pattern; x: number; y: number } | null;
}

export interface ElementaryView {
  width: number;
  height: number;
  cellSize: number;
  showGrid: boolean;
}

function hexToRgb(hex: string): [number, number, number] {
  const value = Number.parseInt(hex.slice(1), 16);
  return [(value >> 16) & 255, (value >> 8) & 255, value & 255];
}

/** 小端序下 ImageData 一个像素的 32 位写法 */
function pack(r: number, g: number, b: number) {
  return (255 << 24) | (b << 16) | (g << 8) | r;
}

function lerp(a: number, b: number, t: number) {
  return Math.round(a + (b - a) * t);
}

/** 按 `ageStops` 的分段插值，预生成 256 级色表 —— 每帧查表，不再算颜色 */
function buildAgeRamp() {
  const ramp = new Uint32Array(256);
  const stops = ageStops.map(
    ([age, hex]) => [age, hexToRgb(hex)] as [number, [number, number, number]]
  );
  for (let age = 0; age < 256; age++) {
    let lo = stops[0];
    let hi = stops[stops.length - 1];
    for (let k = 0; k < stops.length - 1; k++) {
      if (age >= stops[k][0] && age <= stops[k + 1][0]) {
        lo = stops[k];
        hi = stops[k + 1];
        break;
      }
    }
    const span = hi[0] - lo[0];
    const t = span === 0 ? 0 : Math.min(1, Math.max(0, (age - lo[0]) / span));
    ramp[age] = pack(
      lerp(lo[1][0], hi[1][0], t),
      lerp(lo[1][1], hi[1][1], t),
      lerp(lo[1][2], hi[1][2], t)
    );
  }
  return ramp;
}

/** 余晖：从死亡那一刻的颜色一路淡回背景 */
function buildDecayRamp() {
  const ramp = new Uint32Array(DECAY_FRAMES + 1);
  const [br, bg, bb] = hexToRgb(cellColors.background);
  const [dr, dg, db] = hexToRgb(cellColors.decay);
  for (let left = 0; left <= DECAY_FRAMES; left++) {
    const t = left / DECAY_FRAMES;
    ramp[left] = pack(lerp(br, dr, t), lerp(bg, dg, t), lerp(bb, db, t));
  }
  return ramp;
}

const AGE_RAMP = buildAgeRamp();
const DECAY_RAMP = buildDecayRamp();
const BACKGROUND = pack(...hexToRgb(cellColors.background));
const PLAIN = pack(...hexToRgb(cellColors.plain));
const LATEST = pack(...hexToRgb(cellColors.latest));

export class CellularRenderer {
  private readonly buffer = document.createElement('canvas');
  private readonly bufferCtx = this.buffer.getContext('2d', {
    willReadFrequently: false,
  })!;
  private image: ImageData | null = null;
  private pixels: Uint32Array | null = null;

  /** 保证离屏画布正好是 cols × rows 个像素 */
  private ensure(cols: number, rows: number) {
    if (this.buffer.width !== cols || this.buffer.height !== rows) {
      this.buffer.width = cols;
      this.buffer.height = rows;
      this.image = this.bufferCtx.createImageData(cols, rows);
      this.pixels = new Uint32Array(this.image.data.buffer);
    }
    return this.pixels!;
  }

  private blit(
    ctx: CanvasRenderingContext2D,
    cols: number,
    rows: number,
    cellSize: number,
    view: { width: number; height: number; showGrid: boolean }
  ) {
    this.bufferCtx.putImageData(this.image!, 0, 0);

    ctx.fillStyle = cellColors.background;
    ctx.fillRect(0, 0, view.width, view.height);
    // 关掉插值，放大之后格子边缘才是硬的
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(
      this.buffer,
      0,
      0,
      cols,
      rows,
      0,
      0,
      cols * cellSize,
      rows * cellSize
    );
    ctx.imageSmoothingEnabled = true;

    if (!view.showGrid) return;
    ctx.strokeStyle = cellColors.grid;
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let x = 0; x <= cols; x++) {
      // 半像素偏移，避免 1px 的线被抹成两像素灰边
      const px = Math.round(x * cellSize) + 0.5;
      ctx.moveTo(px, 0);
      ctx.lineTo(px, rows * cellSize);
    }
    for (let y = 0; y <= rows; y++) {
      const py = Math.round(y * cellSize) + 0.5;
      ctx.moveTo(0, py);
      ctx.lineTo(cols * cellSize, py);
    }
    ctx.stroke();
  }

  drawLife(ctx: CanvasRenderingContext2D, grid: LifeGrid, view: LifeView) {
    const { cols, rows, cells, age, decay } = grid;
    const pixels = this.ensure(cols, rows);

    for (let i = 0; i < cells.length; i++) {
      if (cells[i]) {
        pixels[i] = view.ageColoring ? AGE_RAMP[age[i]] : PLAIN;
      } else if (view.decayTrails && decay[i] > 0) {
        pixels[i] = DECAY_RAMP[decay[i]];
      } else {
        pixels[i] = BACKGROUND;
      }
    }

    this.blit(ctx, cols, rows, view.cellSize, view);
    if (view.ghost) drawGhost(ctx, view.ghost, view.cellSize);
  }

  drawElementary(
    ctx: CanvasRenderingContext2D,
    ca: ElementaryCA,
    view: ElementaryView
  ) {
    const { width, capacity } = ca;
    const pixels = this.ensure(width, capacity);
    pixels.fill(BACKGROUND);

    for (let row = 0; row < ca.filled; row++) {
      const source = ca.offsetOf(row);
      const target = row * width;
      // 最新一行挑出来单独上色：它是「此刻」，其余都是历史
      const color = row === ca.filled - 1 ? LATEST : PLAIN;
      for (let x = 0; x < width; x++) {
        if (ca.rows[source + x]) pixels[target + x] = color;
      }
    }

    this.blit(ctx, width, capacity, view.cellSize, view);
  }
}

/** 待放置图案的落点预览 */
function drawGhost(
  ctx: CanvasRenderingContext2D,
  ghost: NonNullable<LifeView['ghost']>,
  cellSize: number
) {
  const { pattern, x, y } = ghost;
  const size = patternSize(pattern);

  ctx.save();
  ctx.fillStyle = cellColors.ghost;
  ctx.globalAlpha = 0.75;
  pattern.cells.forEach((line, dy) => {
    [...line].forEach((char, dx) => {
      if (char !== 'O') return;
      ctx.fillRect(
        (x + dx) * cellSize,
        (y + dy) * cellSize,
        cellSize,
        cellSize
      );
    });
  });
  ctx.globalAlpha = 0.35;
  ctx.strokeStyle = cellColors.ghost;
  ctx.lineWidth = 1;
  ctx.strokeRect(
    x * cellSize + 0.5,
    y * cellSize + 0.5,
    size.cols * cellSize,
    size.rows * cellSize
  );
  ctx.restore();
}
