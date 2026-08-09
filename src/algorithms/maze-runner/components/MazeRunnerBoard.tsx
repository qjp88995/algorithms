import { useEffect, useRef, useState } from 'react';

import { createGenerator } from '@/lib/maze/generators';
import { createMazeGrid, indexOf, type MazeGrid } from '@/lib/maze/grid';
import { seededRandom } from '@/lib/random';

import { algorithmLabels } from '../constants';
import { pickExit } from '../exit';
import { computeViewport, renderRun, type Viewport } from '../render';
import {
  createRunner,
  type MazeRunner,
  type RunnerAlgorithm,
  type RunnerStats,
} from '../runner';

export interface MazeRunnerBoardProps {
  algorithm: RunnerAlgorithm;
  cols: number;
  rows: number;
  /** 同一个种子长出同一张迷宫；四块画布共用，比的才是走法 */
  seed: number;
  runId: number;
  /** true 时一路走完，用于跳过过程直接看结果 */
  instant: boolean;
  running: boolean;
  speed: number;
  stepId: number;
  /** 迷雾开关。关掉是上帝视角，用来对照 */
  fog: boolean;
  onFinished: () => void;
  title?: string;
}

const STATS_INTERVAL_MS = 100;

export function MazeRunnerBoard({
  algorithm,
  cols,
  rows,
  seed,
  runId,
  instant,
  running,
  speed,
  stepId,
  fog,
  onFinished,
  title,
}: MazeRunnerBoardProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const gridRef = useRef<MazeGrid>(createMazeGrid(cols, rows));
  const runnerRef = useRef<MazeRunner | null>(null);
  const viewportRef = useRef<Viewport>({ cellSize: 1, offsetX: 0, offsetY: 0 });
  const sizeRef = useRef({ width: 0, height: 0 });
  const dirtyRef = useRef(true);

  const [stats, setStats] = useState<RunnerStats | null>(null);
  const reportedDoneRef = useRef<boolean | null>(null);

  const liveRef = useRef({ running, speed, stepId, fog, onFinished });
  useEffect(() => {
    liveRef.current = { running, speed, stepId, fog, onFinished };
  });
  const steppedRef = useRef(stepId);

  // 迷雾只影响画面，不动模拟 —— 切一下重画即可
  useEffect(() => {
    dirtyRef.current = true;
  }, [fog]);

  const draw = () => {
    const ctx = canvasRef.current?.getContext('2d');
    const { width, height } = sizeRef.current;
    if (!ctx || width === 0 || height === 0) return;
    renderRun(
      ctx,
      gridRef.current,
      runnerRef.current,
      liveRef.current.fog,
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

  // ─── 建立/重建迷宫与走的人 ──────────────────────────────────
  useEffect(() => {
    const grid = createMazeGrid(cols, rows);
    // 迷宫只由种子和尺寸决定，四块画布因此拿到一模一样的一张
    createGenerator('backtracker', grid, seededRandom(seed)).runToEnd();

    // 出口只由种子决定，不看算法 —— 四块画布必须找同一个出口
    const start = indexOf(grid, 1, 1);
    const runner = createRunner(
      algorithm,
      grid,
      start,
      pickExit(grid, start, seededRandom(seed * 7919 + 13)),
      seededRandom(seed * 31 + 7)
    );
    if (instant) runner.runToEnd();

    gridRef.current = grid;
    runnerRef.current = runner;
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
      const runner = runnerRef.current;
      const live = liveRef.current;
      if (!runner) return;

      if (live.stepId !== steppedRef.current) {
        steppedRef.current = live.stepId;
        if (!runner.done) {
          runner.step();
          reportedDoneRef.current = null;
          dirtyRef.current = true;
        }
      }

      const wasRunning = live.running && !runner.done;
      if (wasRunning) {
        runner.advance(live.speed);
        dirtyRef.current = true;
      }

      const settled = reportedDoneRef.current !== runner.done;
      if (settled && runner.done && wasRunning) live.onFinished();
      if (settled || (wasRunning && now - lastStatsAt > STATS_INTERVAL_MS)) {
        reportedDoneRef.current = runner.done;
        setStats(runner.stats());
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

function StatsBar({ stats }: { stats: RunnerStats | null }) {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-line bg-surface px-3 py-1.5 font-mono text-xs tabular-nums">
      <Stat label="步数" value={stats ? String(stats.steps) : '—'} />
      <Stat
        label="踏足"
        value={stats ? `${stats.visited}/${stats.total}` : '—'}
      />
      <Stat label="见过" value={stats ? String(stats.seen) : '—'} />
      {stats?.escaped ? <span className="text-accent">走出去了</span> : null}
      {stats?.done && !stats.escaped ? (
        <span className="text-danger">困住了</span>
      ) : null}
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
