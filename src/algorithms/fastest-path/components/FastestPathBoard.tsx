import {
  type PointerEvent as ReactPointerEvent,
  useEffect,
  useRef,
  useState,
} from 'react';

import {
  computeGraphViewport,
  type GraphViewport,
  nodeAt,
} from '@/lib/graph/geometry';
import { nodeName } from '@/lib/graph/model';

import {
  CLOCK_PER_FRAME,
  FLASH_FRAMES,
  REPLAY_PAUSE_FRAMES,
} from '../constants';
import { FastestPathRun } from '../fastest';
import { formatClock, type RoadNetwork } from '../network';
import { renderScene, type Route } from '../render';
import type { FastestStats } from '../types';

export interface FastestPathBoardProps {
  network: RoadNetwork;
  source: number;
  target: number;
  /** 出发时刻，一天内的分钟数 */
  departure: number;
  runId: number;
  instant: boolean;
  running: boolean;
  speed: number;
  stepId: number;
  onPick: (node: number) => void;
  onFinished: () => void;
}

const STATS_INTERVAL_MS = 100;

export function FastestPathBoard({
  network,
  source,
  target,
  departure,
  runId,
  instant,
  running,
  speed,
  stepId,
  onPick,
  onFinished,
}: FastestPathBoardProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const runRef = useRef<FastestPathRun | null>(null);
  const networkRef = useRef(network);
  const endpointsRef = useRef({ source, target, departure });
  const viewRef = useRef<GraphViewport>({
    scaleX: 1,
    scaleY: 1,
    offsetX: 0,
    offsetY: 0,
    radius: 12,
  });
  const sizeRef = useRef({ width: 0, height: 0 });
  const flashesRef = useRef(new Map<number, number>());

  /** 两条路线和它们的时刻表，跑完之后才有 */
  const routesRef = useRef<{
    fast: Route | null;
    static: Route | null;
    better: number[];
    finish: number;
  }>({ fast: null, static: null, better: [], finish: 0 });
  /** 发车动画的钟；没跑完时就停在出发时刻 */
  const clockRef = useRef(departure);
  const pauseRef = useRef(0);

  const [stats, setStats] = useState<FastestStats | null>(null);
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

    const routes = routesRef.current;
    renderScene(ctx, {
      network: networkRef.current,
      run: runRef.current,
      view: viewRef.current,
      width,
      height,
      source: endpointsRef.current.source,
      target: endpointsRef.current.target,
      clock: clockRef.current,
      flashes: flashesRef.current,
      fast: routes.fast,
      staticRoute: routes.static,
      better: routes.better,
      racing: routes.fast !== null,
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
      viewRef.current = computeGraphViewport(
        networkRef.current.graph,
        width,
        height
      );
    };

    applySize();
    const observer = new ResizeObserver(applySize);
    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  /** 跑完之后把两条路线和它们的时刻表定下来，发车动画照着走 */
  const collectRoutes = (run: FastestPathRun) => {
    const fastPath = run.path();
    const staticPath = run.staticPath();
    const fast: Route | null =
      fastPath.length > 1 ? { path: fastPath, times: run.times() } : null;
    const staticRoute: Route | null =
      staticPath.length > 1
        ? { path: staticPath, times: run.staticTimes() }
        : null;
    routesRef.current = {
      fast,
      static: staticRoute,
      better: run.betterPath(),
      finish: Math.max(
        fast?.times[fast.times.length - 1] ?? 0,
        staticRoute?.times[staticRoute.times.length - 1] ?? 0
      ),
    };
    clockRef.current = run.departure;
    pauseRef.current = 0;
  };

  // ─── 建立/重建搜索 ──────────────────────────────────────────
  useEffect(() => {
    networkRef.current = network;
    endpointsRef.current = { source, target, departure };
    const { width, height } = sizeRef.current;
    if (width > 0 && height > 0) {
      viewRef.current = computeGraphViewport(network.graph, width, height);
    }

    const run = new FastestPathRun(network, source, target, departure);
    runRef.current = run;
    flashesRef.current.clear();
    routesRef.current = { fast: null, static: null, better: [], finish: 0 };
    clockRef.current = departure;
    pauseRef.current = 0;
    if (instant) {
      run.runToEnd();
      collectRoutes(run);
    }
    reportedDoneRef.current = null;
  }, [network, source, target, departure, runId, instant]);

  // ─── 播放循环 ───────────────────────────────────────────────
  useEffect(() => {
    let frame = 0;
    let lastStatsAt = 0;

    const advance = (run: FastestPathRun) => {
      run.step();
      if (run.activeImproved && run.activeEdge >= 0) {
        flashesRef.current.set(run.activeEdge, FLASH_FRAMES);
      }
    };

    const loop = (now: number) => {
      frame = requestAnimationFrame(loop);
      const run = runRef.current;
      const live = liveRef.current;
      if (!run) return;

      if (live.stepId !== steppedRef.current) {
        steppedRef.current = live.stepId;
        if (!run.done) {
          advance(run);
          reportedDoneRef.current = null;
        }
      }

      const wasRunning = live.running && !run.done;
      if (wasRunning) {
        for (let i = 0; i < live.speed && !run.done; i++) advance(run);
      }

      for (const [edge, remaining] of flashesRef.current) {
        if (remaining <= 1) flashesRef.current.delete(edge);
        else flashesRef.current.set(edge, remaining - 1);
      }

      const settled = reportedDoneRef.current !== run.done;
      if (settled && run.done) {
        collectRoutes(run);
        if (wasRunning) live.onFinished();
      }
      if (settled || (wasRunning && now - lastStatsAt > STATS_INTERVAL_MS)) {
        reportedDoneRef.current = run.done;
        setStats(run.stats());
        lastStatsAt = now;
      }

      // 两辆车同时发车：一辆走时间依赖最优路线，一辆走静态路线。
      // 走完停一会儿再重来 —— 这是整页最能说明问题的一幕
      const routes = routesRef.current;
      if (routes.fast) {
        if (pauseRef.current > 0) {
          if (--pauseRef.current === 0) clockRef.current = run.departure;
        } else {
          clockRef.current += CLOCK_PER_FRAME;
          if (clockRef.current >= routes.finish) {
            clockRef.current = routes.finish;
            pauseRef.current = REPLAY_PAUSE_FRAMES;
          }
        }
      }

      draw();
    };

    frame = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(frame);
    // 空依赖是刻意的：循环只建立一次，会变的东西全走 liveRef / routesRef
  }, []);

  const handleClick = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const node = nodeAt(
      networkRef.current.graph,
      viewRef.current,
      event.clientX - rect.left,
      event.clientY - rect.top
    );
    if (node >= 0) onPick(node);
  };

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-xl border border-line bg-canvas">
      <div className="flex items-baseline gap-2 border-b border-line px-3 py-1.5">
        <span className="text-xs font-medium">时间依赖 Dijkstra</span>
        <span className="font-mono text-xs text-faint">
          {nodeName(source)} → {nodeName(target)} · {formatClock(departure)}{' '}
          出发
        </span>
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

function StatsBar({ stats }: { stats: FastestStats | null }) {
  const gap =
    stats && Number.isFinite(stats.staticArrival) && stats.reached
      ? stats.staticArrival - stats.arrival
      : 0;

  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-line bg-surface px-3 py-1.5 font-mono text-xs tabular-nums">
      <Stat
        label="到达"
        value={stats?.reached ? formatClock(stats.arrival) : '—'}
      />
      <Stat
        label="时长"
        value={stats?.reached ? `${Math.round(stats.duration)} 分` : '—'}
      />
      <Stat
        label="静态路线"
        value={
          stats && Number.isFinite(stats.staticArrival)
            ? `${formatClock(stats.staticArrival)}${gap > 0.5 ? ` (慢 ${Math.round(gap)} 分)` : ''}`
            : '—'
        }
      />
      <Stat label="检查边" value={stats ? String(stats.checks) : '—'} />
      <Stat
        label="已定稿"
        value={stats ? `${stats.settled}/${stats.total}` : '—'}
      />
      {stats && stats.lateBy > 0.5 ? (
        <span className="text-danger">
          FIFO 失效 · 存在早 {Math.round(stats.lateBy)} 分钟到达的路线
        </span>
      ) : null}
      {stats?.done && !stats.reached ? (
        <span className="text-danger">不可达</span>
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
