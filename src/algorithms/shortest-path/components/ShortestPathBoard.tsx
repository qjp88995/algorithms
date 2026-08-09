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
  algorithmLabels,
  FLASH_FRAMES,
  PATH_REVEAL_PER_FRAME,
} from '../constants';
import { formatDistance, renderScene } from '../render';
import type { ShortestScene } from '../scene';
import { ShortestPathRun } from '../shortest';
import type { ShortestAlgorithm, ShortestStats } from '../types';

export interface ShortestPathBoardProps {
  scene: ShortestScene;
  algorithm: ShortestAlgorithm;
  source: number;
  target: number;
  /** 变化即重建搜索 */
  runId: number;
  /** true 时立即算到底，用于拖滑块时实时看结果 */
  instant: boolean;
  running: boolean;
  /** 每帧检查多少条边 */
  speed: number;
  /** 递增即前进一步。用计数器而不是回调，rAF 循环才不用重建 */
  stepId: number;
  onPick: (node: number) => void;
  onFinished: () => void;
}

const STATS_INTERVAL_MS = 100;

export function ShortestPathBoard({
  scene,
  algorithm,
  source,
  target,
  runId,
  instant,
  running,
  speed,
  stepId,
  onPick,
  onFinished,
}: ShortestPathBoardProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const runRef = useRef<ShortestPathRun | null>(null);
  const sceneRef = useRef(scene);
  const endpointsRef = useRef({ source, target });
  const viewRef = useRef<GraphViewport>({
    scaleX: 1,
    scaleY: 1,
    offsetX: 0,
    offsetY: 0,
    radius: 12,
  });
  const sizeRef = useRef({ width: 0, height: 0 });
  const pathRef = useRef<number[]>([]);
  const revealRef = useRef(0);
  /** 边下标 → 余晖剩余帧数 */
  const flashesRef = useRef(new Map<number, number>());
  const pulseRef = useRef(0);

  const [stats, setStats] = useState<ShortestStats | null>(null);
  const reportedDoneRef = useRef<boolean | null>(null);

  const liveRef = useRef({ running, speed, stepId, onFinished });
  useEffect(() => {
    liveRef.current = { running, speed, stepId, onFinished };
  });
  const steppedRef = useRef(stepId);

  const draw = () => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    const { width, height } = sizeRef.current;
    if (!ctx || width === 0 || height === 0) return;

    renderScene(ctx, {
      scene: sceneRef.current,
      run: runRef.current,
      view: viewRef.current,
      width,
      height,
      source: endpointsRef.current.source,
      target: endpointsRef.current.target,
      flashes: flashesRef.current,
      path: pathRef.current,
      revealed: revealRef.current,
      pulse: pulseRef.current,
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
        sceneRef.current.graph,
        width,
        height
      );
    };

    applySize();
    const observer = new ResizeObserver(applySize);
    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  // ─── 建立/重建搜索 ──────────────────────────────────────────
  // 只创建实例，不 setState：统计交给下面的循环上报，
  // 免得在 effect 里同步 setState 引发级联渲染。
  useEffect(() => {
    sceneRef.current = scene;
    endpointsRef.current = { source, target };
    const { width, height } = sizeRef.current;
    if (width > 0 && height > 0) {
      viewRef.current = computeGraphViewport(scene.graph, width, height);
    }

    const run = new ShortestPathRun(scene, algorithm, source, target);
    runRef.current = run;
    flashesRef.current.clear();
    if (instant) {
      run.runToEnd();
      pathRef.current = run.path();
      revealRef.current = pathRef.current.length;
    } else {
      pathRef.current = [];
      revealRef.current = 0;
    }
    reportedDoneRef.current = null;
  }, [scene, algorithm, source, target, runId, instant]);

  // ─── 播放循环 ───────────────────────────────────────────────
  useEffect(() => {
    let frame = 0;
    let lastStatsAt = 0;

    /** 走一步，成功松弛的边留下余晖 */
    const advance = (run: ShortestPathRun) => {
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

      pulseRef.current++;

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
        pathRef.current = run.path();
        if (wasRunning) live.onFinished();
      }
      if (settled || (wasRunning && now - lastStatsAt > STATS_INTERVAL_MS)) {
        reportedDoneRef.current = run.done;
        setStats(run.stats());
        lastStatsAt = now;
      }

      if (run.done && revealRef.current < pathRef.current.length) {
        revealRef.current += PATH_REVEAL_PER_FRAME;
      }

      draw();
    };

    frame = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(frame);
    // 空依赖是刻意的：循环只建立一次，会变的东西全走 liveRef
  }, []);

  const handleClick = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const node = nodeAt(
      sceneRef.current.graph,
      viewRef.current,
      event.clientX - rect.left,
      event.clientY - rect.top
    );
    if (node >= 0) onPick(node);
  };

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-xl border border-line bg-canvas">
      <div className="flex items-baseline gap-2 border-b border-line px-3 py-1.5">
        <span className="text-xs font-medium">
          {algorithmLabels[algorithm].label}
        </span>
        <span className="font-mono text-xs text-faint">
          {algorithmLabels[algorithm].complexity}
        </span>
        <span className="ml-auto font-mono text-xs text-faint">
          {nodeName(source)} → {nodeName(target)}
        </span>
      </div>

      <div ref={containerRef} className="relative min-h-0 flex-1">
        <canvas
          ref={canvasRef}
          className="block size-full cursor-pointer touch-none"
          onPointerDown={handleClick}
        />
      </div>

      <StatsBar stats={stats} algorithm={algorithm} />
    </div>
  );
}

function StatsBar({
  stats,
  algorithm,
}: {
  stats: ShortestStats | null;
  algorithm: ShortestAlgorithm;
}) {
  const roundLabel =
    algorithm === 'dijkstra'
      ? '已定稿'
      : algorithm === 'bellman-ford'
        ? '轮次'
        : '中转点 k';

  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-line bg-surface px-3 py-1.5 font-mono text-xs tabular-nums">
      <Stat label="检查边" value={stats ? String(stats.checks) : '—'} />
      <Stat label="松弛成功" value={stats ? String(stats.improvements) : '—'} />
      <Stat
        label={roundLabel}
        value={stats ? `${stats.round}/${stats.totalRounds}` : '—'}
      />
      <Stat
        label="距离"
        value={stats?.reached ? formatDistance(stats.distance) : '—'}
      />
      <Stat label="跳数" value={stats?.reached ? String(stats.hops) : '—'} />
      {stats?.negativeCycle ? (
        <span className="text-danger">检测到负环 · 最短路不存在</span>
      ) : null}
      {stats?.wrong ? (
        <span className="text-danger">{stats.wrong} 个节点算错了</span>
      ) : null}
      {stats?.done && !stats.reached && !stats.negativeCycle ? (
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
