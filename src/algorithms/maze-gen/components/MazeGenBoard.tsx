import { useEffect, useRef, useState } from 'react';

import {
  createGenerator,
  type MazeAlgorithm,
  type MazeGenerator,
  type MazeGenStats,
} from '@/lib/maze/generators';
import { countDeadEnds, createMazeGrid, type MazeGrid } from '@/lib/maze/grid';
import { seededRandom } from '@/lib/random';

import { algorithmLabels } from '../constants';
import { computeViewport, renderMaze, type Viewport } from '../render';

export interface MazeGenBoardProps {
  algorithm: MazeAlgorithm;
  cols: number;
  rows: number;
  /** 同一个种子长出同一张迷宫；对比模式下四块板共用，比较才成立 */
  seed: number;
  /** 变化即重建：改了尺寸、换了种子、点了重置 */
  runId: number;
  /** true 时一次生成完，用于跳过过程直接看结果 */
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

/** 死胡同要扫全图，只在跑完那一下算一次 */
interface BoardStats extends MazeGenStats {
  deadEnds: number;
}

const STATS_INTERVAL_MS = 100;

export function MazeGenBoard({
  algorithm,
  cols,
  rows,
  seed,
  runId,
  instant,
  running,
  speed,
  stepId,
  onFinished,
  title,
}: MazeGenBoardProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const gridRef = useRef<MazeGrid>(createMazeGrid(cols, rows));
  const generatorRef = useRef<MazeGenerator | null>(null);
  const viewportRef = useRef<Viewport>({ cellSize: 1, offsetX: 0, offsetY: 0 });
  const sizeRef = useRef({ width: 0, height: 0 });
  const dirtyRef = useRef(true);

  const [stats, setStats] = useState<BoardStats | null>(null);
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
    renderMaze(
      ctx,
      gridRef.current,
      generatorRef.current,
      width,
      height,
      viewportRef.current
    );
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
      viewportRef.current = computeViewport(gridRef.current, width, height);
      dirtyRef.current = true;
    };

    applySize();
    const observer = new ResizeObserver(applySize);
    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  // ─── 建立/重建生成器 ────────────────────────────────────────
  // 每块画布持有自己的网格：四种算法长出的是四张不同的迷宫，
  // 不像寻路那样四个算法跑同一张地图。
  useEffect(() => {
    const grid = createMazeGrid(cols, rows);
    const generator = createGenerator(algorithm, grid, seededRandom(seed));
    if (instant) generator.runToEnd();

    gridRef.current = grid;
    generatorRef.current = generator;
    reportedDoneRef.current = null;
    const { width, height } = sizeRef.current;
    if (width > 0) viewportRef.current = computeViewport(grid, width, height);
    dirtyRef.current = true;
  }, [algorithm, cols, rows, seed, runId, instant]);

  // ─── 播放循环 ───────────────────────────────────────────────
  useEffect(() => {
    let frame = 0;
    let lastStatsAt = 0;

    const loop = (now: number) => {
      frame = requestAnimationFrame(loop);
      const generator = generatorRef.current;
      const live = liveRef.current;
      if (!generator) return;

      if (live.stepId !== steppedRef.current) {
        steppedRef.current = live.stepId;
        if (!generator.done) {
          generator.step();
          reportedDoneRef.current = null;
          dirtyRef.current = true;
        }
      }

      const wasRunning = live.running && !generator.done;
      if (wasRunning) {
        generator.advance(live.speed);
        dirtyRef.current = true;
      }

      const settled = reportedDoneRef.current !== generator.done;
      if (settled && generator.done && wasRunning) live.onFinished();
      if (settled || (wasRunning && now - lastStatsAt > STATS_INTERVAL_MS)) {
        reportedDoneRef.current = generator.done;
        const base = generator.stats();
        setStats({
          ...base,
          deadEnds: base.done ? countDeadEnds(gridRef.current) : 0,
        });
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
            {algorithmLabels[algorithm].key}
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

function StatsBar({ stats }: { stats: BoardStats | null }) {
  const progress = stats ? `${stats.carved}/${stats.total}` : '—';
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-line bg-surface px-3 py-1.5 font-mono text-xs tabular-nums">
      <Stat label="并入" value={progress} />
      <Stat label="步数" value={stats ? String(stats.steps) : '—'} />
      <Stat label="活跃" value={stats ? String(stats.active) : '—'} />
      <Stat label="死胡同" value={stats?.done ? String(stats.deadEnds) : '—'} />
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
