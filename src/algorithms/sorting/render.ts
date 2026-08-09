import { sortColors } from './constants';
import { MARK_DONE, MARK_RANGE, type Sorter } from './sorter';

/**
 * 一根柱子一个元素，高度就是值。
 *
 * 不做静态层缓存：排序每一步都在改数组，缓存下来的那一层下一帧就作废了 ——
 * 和迷宫生成同理，全量重画反而更简单。n 最大 240，每帧 240 个 fillRect
 * 对 canvas 来说毫无压力。
 */
export function renderBars(
  ctx: CanvasRenderingContext2D,
  sorter: Sorter,
  maxValue: number,
  width: number,
  height: number
) {
  ctx.fillStyle = sortColors.background;
  ctx.fillRect(0, 0, width, height);

  const { values, mark, n } = sorter;
  if (n === 0 || width <= 0 || height <= 0) return;

  const slot = width / n;
  // 柱子密到一定程度就不留缝了，否则缝比柱子还宽
  const gap = slot > 4 ? 1 : 0;
  const barWidth = Math.max(1, slot - gap);

  for (let i = 0; i < n; i++) {
    const barHeight = Math.max(1, (values[i] / maxValue) * height);
    ctx.fillStyle = colorOf(sorter, mark[i], i);
    ctx.fillRect(i * slot, height - barHeight, barWidth, barHeight);
  }
}

/**
 * 一根柱子只能有一个颜色，所以顺序就是优先级：
 * 这一步碰到的 > 被盯住的 > 已定稿 > 在当前区间里。
 * 「碰到的」排最前，是因为它每帧都在变 —— 那正是眼睛要跟的东西。
 */
function colorOf(sorter: Sorter, mark: number, index: number) {
  if (index === sorter.a || index === sorter.b) return sortColors.active;
  if (index === sorter.focus) return sortColors.focus;
  if (mark === MARK_DONE) return sortColors.done;
  if (mark === MARK_RANGE) return sortColors.range;
  return sortColors.bar;
}
