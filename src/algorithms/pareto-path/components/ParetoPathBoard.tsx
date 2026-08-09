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

import { FLASH_FRAMES } from '../constants';
import type { TollNetwork } from '../network';
import { ParetoRun } from '../pareto';
import { renderScene } from '../render';
import type { ParetoSolution, ParetoStats } from '../types';
import type { ParetoResult } from '../useParetoPath';

export interface ParetoPathBoardProps {
  network: TollNetwork;
  source: number;
  target: number;
  runId: number;
  instant: boolean;
  running: boolean;
  speed: number;
  stepId: number;
  /** 高亮哪一个解 */
  selected: number;
  onPick: (node: number) => void;
  onFinished: () => void;
  onSolved: (result: ParetoResult) => void;
}

const STATS_INTERVAL_MS = 100;

export function ParetoPathBoard({
  network,
  source,
  target,
  runId,
  instant,
  running,
  speed,
  stepId,
  selected,
  onPick,
  onFinished,
  onSolved,
}: ParetoPathBoardProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const runRef = useRef<ParetoRun | null>(null);
  const networkRef = useRef(network);
  const endpointsRef = useRef({ source, target });
  const viewRef = useRef<GraphViewport>({
    scaleX: 1,
    scaleY: 1,
    offsetX: 0,
    offsetY: 0,
    radius: 12,
  });
  const sizeRef = useRef({ width: 0, height: 0 });
  const flashesRef = useRef(new Map<number, number>());
  /** 跑完之后才有；搜索过程中画布上不该出现答案 */
  const solutionsRef = useRef<ParetoSolution[]>([]);

  const [stats, setStats] = useState<ParetoStats | null>(null);
  const reportedDoneRef = useRef<boolean | null>(null);

  const liveRef = useRef({
    running,
    speed,
    stepId,
    selected,
    onFinished,
    onSolved,
  });
  useEffect(() => {
    liveRef.current = {
      running,
      speed,
      stepId,
      selected,
      onFinished,
      onSolved,
    };
  });
  const steppedRef = useRef(stepId);

  const draw = () => {
    const ctx = canvasRef.current?.getContext('2d');
    const { width, height } = sizeRef.current;
    if (!ctx || width === 0 || height === 0) return;

    renderScene(ctx, {
      network: networkRef.current,
      run: runRef.current,
      view: viewRef.current,
      width,
      height,
      source: endpointsRef.current.source,
      target: endpointsRef.current.target,
      solutions: solutionsRef.current,
      selected: liveRef.current.selected,
      flashes: flashesRef.current,
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

  // ─── 建立/重建搜索 ──────────────────────────────────────────
  useEffect(() => {
    networkRef.current = network;
    endpointsRef.current = { source, target };
    const { width, height } = sizeRef.current;
    if (width > 0 && height > 0) {
      viewRef.current = computeGraphViewport(network.graph, width, height);
    }

    const run = new ParetoRun(network, source, target);
    runRef.current = run;
    flashesRef.current.clear();
    solutionsRef.current = [];
    if (instant) {
      run.runToEnd();
      solutionsRef.current = run.solutions();
    }
    reportedDoneRef.current = null;
  }, [network, source, target, runId, instant]);

  // ─── 播放循环 ───────────────────────────────────────────────
  useEffect(() => {
    let frame = 0;
    let lastStatsAt = 0;

    const advance = (run: ParetoRun) => {
      run.step();
      if (run.activeAccepted && run.activeEdge >= 0) {
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
        solutionsRef.current = run.solutions();
        live.onSolved({
          solutions: solutionsRef.current,
          samples: [...run.samples],
        });
        if (wasRunning) live.onFinished();
      }
      if (settled || (wasRunning && now - lastStatsAt > STATS_INTERVAL_MS)) {
        reportedDoneRef.current = run.done;
        setStats(run.stats());
        lastStatsAt = now;
      }

      draw();
    };

    frame = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(frame);
    // 空依赖是刻意的：循环只建立一次，会变的东西全走 liveRef / solutionsRef
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
        <span className="text-xs font-medium">多目标标签设定</span>
        <span className="font-mono text-xs text-faint">
          {nodeName(source)} → {nodeName(target)} · 时间 / 过路费
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

function StatsBar({ stats }: { stats: ParetoStats | null }) {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-line bg-surface px-3 py-1.5 font-mono text-xs tabular-nums">
      <Stat
        label="前沿"
        value={stats?.done ? `${stats.frontier} 条` : '—'}
        hint="终点上互不支配的路线条数"
      />
      <Stat
        label="其中角点"
        value={stats?.done ? `${stats.supported} 条` : '—'}
        hint="加权和调权重能选到的那些"
      />
      <Stat
        label="标签"
        value={stats ? `${stats.alive}/${stats.created}` : '—'}
      />
      <Stat
        label="剪掉"
        value={stats ? `${stats.pruned + stats.dropped}` : '—'}
        hint="生成时就被支配的 + 后来被淘汰的"
      />
      <Stat label="检查边" value={stats ? String(stats.checks) : '—'} />
      {stats?.done && stats.frontier === 0 ? (
        <span className="text-danger">不可达</span>
      ) : null}
      {stats?.overflow ? (
        <span className="text-danger">标签数超上限，搜索已中止</span>
      ) : null}
    </div>
  );
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
