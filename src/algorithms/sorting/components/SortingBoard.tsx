import { useEffect, useRef, useState } from 'react';

import { algorithmLabels } from '../constants';
import { type Distribution, makeValues } from '../data';
import { renderBars } from '../render';
import { createSorter, type SortAlgorithm, type SortStats } from '../sorter';

export interface SortingBoardProps {
  algorithm: SortAlgorithm;
  size: number;
  distribution: Distribution;
  /** 同样的 (size, distribution, seed) 给出同一个数组 */
  seed: number;
  /** 变化即重建：改了个数、换了分布、换了种子、点了重置 */
  runId: number;
  /** true 时一次排完，用于跳过过程直接看统计 */
  instant: boolean;
  running: boolean;
  /** 每帧执行多少步 */
  speed: number;
  /** 递增即执行一步 */
  stepId: number;
  onFinished: () => void;
  /** 对比模式下每块画布顶部标出算法名 */
  title?: string;
}

const STATS_INTERVAL_MS = 100;

export function SortingBoard({
  algorithm,
  size,
  distribution,
  seed,
  runId,
  instant,
  running,
  speed,
  stepId,
  onFinished,
  title,
}: SortingBoardProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sorterRef = useRef(createSorter(algorithm, makeValues(1, 'random', 1)));
  const maxValueRef = useRef(1);
  const sizeRef = useRef({ width: 0, height: 0 });
  const dirtyRef = useRef(true);

  const [stats, setStats] = useState<SortStats | null>(null);
  const reportedDoneRef = useRef<boolean | null>(null);

  const liveRef = useRef({ running, speed, stepId, onFinished });
  useEffect(() => {
    liveRef.current = { running, speed, stepId, onFinished };
  });
  const steppedRef = useRef(stepId);

  const draw = () => {
    const ctx = canvasRef.current?.getContext('2d');
    const { width, height } = sizeRef.current;
    if (!ctx || width === 0 || height === 0) return;
    renderBars(ctx, sorterRef.current, maxValueRef.current, width, height);
  };

  // ─── 画布尺寸 ───────────────────────────────────────────────
  useEffect(() => {
    const container = containerRef.current;
    const canvas = canvasRef.current;
    if (!container || !canvas) return;

    const applySize = () => {
      const { width, height } = container.getBoundingClientRect();
      if (width === 0 || height === 0) return;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      canvas.getContext('2d')?.setTransform(dpr, 0, 0, dpr, 0, 0);

      sizeRef.current = { width, height };
      dirtyRef.current = true;
    };

    applySize();
    const observer = new ResizeObserver(applySize);
    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  // ─── 建立/重建排序过程 ──────────────────────────────────────
  // 每块画布持有自己的数组：六个算法都是原地排序，共用一份会互相踩。
  // 但它们由同一组参数生成，所以内容逐位相同。
  useEffect(() => {
    const values = makeValues(size, distribution, seed);
    let maxValue = 1;
    for (const value of values) {
      if (value > maxValue) maxValue = value;
    }
    const sorter = createSorter(algorithm, values);
    if (instant) sorter.runToEnd();

    sorterRef.current = sorter;
    maxValueRef.current = maxValue;
    // 置空即宣告"这一轮还没报过状态"，下一帧循环会立刻补一次统计
    reportedDoneRef.current = null;
    dirtyRef.current = true;
  }, [algorithm, size, distribution, seed, runId, instant]);

  // ─── 播放循环 ───────────────────────────────────────────────
  useEffect(() => {
    let frame = 0;
    let lastStatsAt = 0;

    const loop = (now: number) => {
      frame = requestAnimationFrame(loop);
      const sorter = sorterRef.current;
      const live = liveRef.current;

      if (live.stepId !== steppedRef.current) {
        steppedRef.current = live.stepId;
        if (sorter.step()) {
          reportedDoneRef.current = null;
          dirtyRef.current = true;
        }
      }

      const wasRunning = live.running && !sorter.done;
      if (wasRunning) {
        sorter.advance(live.speed);
        dirtyRef.current = true;
      }

      const settled = reportedDoneRef.current !== sorter.done;
      if (settled && sorter.done && wasRunning) live.onFinished();
      if (settled || (wasRunning && now - lastStatsAt > STATS_INTERVAL_MS)) {
        reportedDoneRef.current = sorter.done;
        setStats(sorter.stats());
        lastStatsAt = now;
      }

      if (dirtyRef.current) {
        draw();
        dirtyRef.current = false;
      }
    };

    frame = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(frame);
    // 空依赖是有意的：循环只建立一次，会变的量全走 liveRef
  }, []);

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-xl border border-line bg-canvas">
      {title ? (
        <div className="flex items-baseline gap-2 border-b border-line px-3 py-1.5">
          <span className="text-xs font-medium">{title}</span>
          <span className="font-mono text-xs text-faint">
            {algorithmLabels[algorithm].complexity}
          </span>
        </div>
      ) : null}

      <div ref={containerRef} className="relative min-h-0 flex-1">
        <canvas ref={canvasRef} className="block size-full" />
      </div>

      <StatsBar stats={stats} />
    </div>
  );
}

function StatsBar({ stats }: { stats: SortStats | null }) {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-line bg-surface px-3 py-1.5 font-mono text-xs tabular-nums">
      <Stat label="比较" value={stats ? String(stats.comparisons) : '—'} />
      <Stat label="写入" value={stats ? String(stats.writes) : '—'} />
      <Stat label="步数" value={stats ? String(stats.steps) : '—'} />
      <Stat label="状态" value={stats?.done ? '已排好' : '排序中'} />
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <span className="flex items-baseline gap-1">
      <span className="text-faint">{label}</span>
      <span className="text-ink">{value}</span>
    </span>
  );
}
