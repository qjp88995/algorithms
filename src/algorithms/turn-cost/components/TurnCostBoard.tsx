import {
  type PointerEvent as ReactPointerEvent,
  useEffect,
  useRef,
} from 'react';

import { turnColors } from '../constants';
import { DIR_ARROWS } from '../grid';
import {
  cellAt,
  computeViewport,
  type GridViewport,
  renderScene,
  type Route,
} from '../render';
import { TurnRun } from '../turn';
import type { Dir, TurnCosts, TurnGrid, TurnStats } from '../types';

export interface TurnCostBoardProps {
  grid: TurnGrid;
  costs: TurnCosts;
  startDir: Dir;
  runId: number;
  instant: boolean;
  running: boolean;
  speed: number;
  stepId: number;
  showStates: boolean;
  stats: TurnStats | null;
  onPickGoal: (cell: number) => void;
  onFinished: () => void;
  onStats: (stats: TurnStats) => void;
}

const STATS_INTERVAL_MS = 120;

export function TurnCostBoard({
  grid,
  costs,
  startDir,
  runId,
  instant,
  running,
  speed,
  stepId,
  showStates,
  stats,
  onPickGoal,
  onFinished,
  onStats,
}: TurnCostBoardProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const runRef = useRef<TurnRun | null>(null);
  const gridRef = useRef(grid);
  const viewRef = useRef<GridViewport>({ cell: 12, offsetX: 0, offsetY: 0 });
  const sizeRef = useRef({ width: 0, height: 0 });
  /** 跑完之后才有；搜索过程中画布上不该出现答案 */
  const routesRef = useRef<Route[]>([]);

  const reportedDoneRef = useRef<boolean | null>(null);
  const liveRef = useRef({
    running,
    speed,
    stepId,
    showStates,
    startDir,
    onFinished,
    onStats,
  });
  useEffect(() => {
    liveRef.current = {
      running,
      speed,
      stepId,
      showStates,
      startDir,
      onFinished,
      onStats,
    };
  });
  const steppedRef = useRef(stepId);

  const draw = () => {
    const ctx = canvasRef.current?.getContext('2d');
    const { width, height } = sizeRef.current;
    if (!ctx || width === 0 || height === 0) return;

    renderScene(ctx, {
      grid: gridRef.current,
      run: runRef.current,
      view: viewRef.current,
      width,
      height,
      startDir: liveRef.current.startDir,
      routes: routesRef.current,
      showStates: liveRef.current.showStates,
    });
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
      viewRef.current = computeViewport(gridRef.current, width, height);
    };

    applySize();
    const observer = new ResizeObserver(applySize);
    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  /** 三条路线一起画，粗的在下、细的在上，重叠的段落也看得出层次 */
  const collectRoutes = (run: TurnRun) => {
    routesRef.current = [
      {
        cells: run.stepsFirstPath(),
        color: turnColors.routeStepsFirst,
        width: 7,
      },
      {
        cells: run.naivePath(),
        color: turnColors.routeNaive,
        width: 4.5,
        dashed: true,
      },
      { cells: run.path(), color: turnColors.routeBest, width: 2.5 },
    ];
  };

  // ─── 建立/重建搜索 ──────────────────────────────────────────
  useEffect(() => {
    gridRef.current = grid;
    const { width, height } = sizeRef.current;
    if (width > 0 && height > 0) {
      viewRef.current = computeViewport(grid, width, height);
    }

    const run = new TurnRun(grid, costs, startDir);
    runRef.current = run;
    routesRef.current = [];
    if (instant) {
      run.runToEnd();
      collectRoutes(run);
    }
    reportedDoneRef.current = null;
  }, [grid, costs, startDir, runId, instant]);

  // ─── 播放循环 ───────────────────────────────────────────────
  useEffect(() => {
    let frame = 0;
    let lastStatsAt = 0;

    const loop = (now: number) => {
      frame = requestAnimationFrame(loop);
      const run = runRef.current;
      const live = liveRef.current;
      if (!run) return;

      if (live.stepId !== steppedRef.current) {
        steppedRef.current = live.stepId;
        if (!run.done) {
          run.step();
          reportedDoneRef.current = null;
        }
      }

      const wasRunning = live.running && !run.done;
      if (wasRunning) run.advance(live.speed);

      const settled = reportedDoneRef.current !== run.done;
      if (settled && run.done) {
        collectRoutes(run);
        if (wasRunning) live.onFinished();
      }
      if (settled || (wasRunning && now - lastStatsAt > STATS_INTERVAL_MS)) {
        reportedDoneRef.current = run.done;
        live.onStats(run.stats());
        lastStatsAt = now;
      }

      draw();
    };

    frame = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(frame);
    // 空依赖是刻意的：循环只建立一次，会变的东西全走 liveRef / routesRef
  }, []);

  const handleClick = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const cell = cellAt(
      gridRef.current,
      viewRef.current,
      event.clientX - rect.left,
      event.clientY - rect.top
    );
    if (cell >= 0) onPickGoal(cell);
  };

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-xl border border-line bg-canvas">
      <div className="flex items-baseline gap-2 border-b border-line px-3 py-1.5">
        <span className="text-xs font-medium">格子 × 朝向 上的 Dijkstra</span>
        <span className="font-mono text-xs text-faint">
          出发朝向 {DIR_ARROWS[startDir]} · 转弯 +{costs.turn} · 掉头 +
          {costs.uTurn}
        </span>
        <span className="ml-auto text-xs text-faint">点空地可以搬终点</span>
      </div>

      <div ref={containerRef} className="relative min-h-0 flex-1">
        <canvas
          ref={canvasRef}
          className="block size-full cursor-pointer touch-none"
          onPointerDown={handleClick}
        />
      </div>

      <StatsBar stats={stats} />
    </div>
  );
}

function StatsBar({ stats }: { stats: TurnStats | null }) {
  const gap =
    stats?.best && stats.stepsFirst
      ? stats.stepsFirst.cost - stats.best.cost
      : 0;

  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-line bg-surface px-3 py-1.5 font-mono text-xs tabular-nums">
      <Stat
        label="已定稿状态"
        value={stats ? `${stats.expanded}/${stats.total}` : '—'}
        hint="状态 = 格子 × 朝向，所以分母是可通行格子数的四倍"
      />
      <Stat label="边界" value={stats ? String(stats.frontier) : '—'} />
      <Stat
        label="最优代价"
        value={stats?.best ? String(round(stats.best.cost)) : '—'}
      />
      <Stat
        label="步数 / 转弯"
        value={
          stats?.best
            ? `${stats.best.steps} / ${stats.best.turns + stats.best.uTurns}`
            : '—'
        }
      />
      {stats?.done && gap > 0 ? (
        <span className="text-danger">步数优先的那条贵 {round(gap)}</span>
      ) : null}
      {stats?.done && !stats.found ? (
        <span className="text-danger">不可达</span>
      ) : null}
    </div>
  );
}

function round(value: number) {
  return Math.round(value * 10) / 10;
}

function Stat({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <span className="flex items-baseline gap-1" title={hint}>
      <span className="text-faint">{label}</span>
      <span className="text-ink">{value}</span>
    </span>
  );
}
