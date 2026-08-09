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

import { algorithmLabels, FLASH_FRAMES } from '../constants';
import type { TreeComparison } from '../reference';
import { formatDistance, renderScene } from '../render';
import type { SpanningScene } from '../scene';
import { SpanningTreeRun } from '../spanning';
import type { SpanningAlgorithm, SpanningStats } from '../types';

export interface SpanningTreeBoardProps {
  scene: SpanningScene;
  algorithm: SpanningAlgorithm;
  root: number;
  /** 打开对照时才有；只影响画面，不影响算法 */
  comparison: TreeComparison | null;
  /** 变化即重建这一局 */
  runId: number;
  /** true 时立即算到底，用于拖滑块时实时看结果 */
  instant: boolean;
  running: boolean;
  /** 每帧考察多少条边 */
  speed: number;
  /** 递增即前进一步。用计数器而不是回调，rAF 循环才不用重建 */
  stepId: number;
  onPick: (node: number) => void;
  onFinished: () => void;
}

const STATS_INTERVAL_MS = 100;

export function SpanningTreeBoard({
  scene,
  algorithm,
  root,
  comparison,
  runId,
  instant,
  running,
  speed,
  stepId,
  onPick,
  onFinished,
}: SpanningTreeBoardProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const runRef = useRef<SpanningTreeRun | null>(null);
  const sceneRef = useRef(scene);
  const rootRef = useRef(root);
  const comparisonRef = useRef(comparison);
  const viewRef = useRef<GraphViewport>({
    scaleX: 1,
    scaleY: 1,
    offsetX: 0,
    offsetY: 0,
    radius: 12,
  });
  const sizeRef = useRef({ width: 0, height: 0 });
  /** 边下标 → 余晖剩余帧数 */
  const flashesRef = useRef(new Map<number, number>());
  const pulseRef = useRef(0);

  const [stats, setStats] = useState<SpanningStats | null>(null);
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
      comparison: comparisonRef.current,
      view: viewRef.current,
      width,
      height,
      root: rootRef.current,
      flashes: flashesRef.current,
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

  // 对照是纯展示，换了不重建这一局 —— 播到一半按 T 也不会打断
  useEffect(() => {
    comparisonRef.current = comparison;
  }, [comparison]);

  // ─── 建立/重建这一局 ────────────────────────────────────────
  // 只创建实例，不 setState：统计交给下面的循环上报，
  // 免得在 effect 里同步 setState 引发级联渲染。
  useEffect(() => {
    sceneRef.current = scene;
    rootRef.current = root;
    const { width, height } = sizeRef.current;
    if (width > 0 && height > 0) {
      viewRef.current = computeGraphViewport(scene.graph, width, height);
    }

    const run = new SpanningTreeRun(scene, algorithm, root);
    runRef.current = run;
    flashesRef.current.clear();
    if (instant) run.runToEnd();
    reportedDoneRef.current = null;
  }, [scene, algorithm, root, runId, instant]);

  // ─── 播放循环 ───────────────────────────────────────────────
  useEffect(() => {
    let frame = 0;
    let lastStatsAt = 0;

    /** 走一步，收下的边留下余晖 */
    const advance = (run: SpanningTreeRun) => {
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

      for (const [link, remaining] of flashesRef.current) {
        if (remaining <= 1) flashesRef.current.delete(link);
        else flashesRef.current.set(link, remaining - 1);
      }

      const settled = reportedDoneRef.current !== run.done;
      if (settled && run.done && wasRunning) live.onFinished();
      if (settled || (wasRunning && now - lastStatsAt > STATS_INTERVAL_MS)) {
        reportedDoneRef.current = run.done;
        setStats(run.stats());
        lastStatsAt = now;
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
          根 {nodeName(root)}
        </span>
      </div>

      <div ref={containerRef} className="relative min-h-0 flex-1">
        <canvas
          ref={canvasRef}
          className="block size-full cursor-pointer touch-none"
          onPointerDown={handleClick}
        />
      </div>

      <StatsBar stats={stats} algorithm={algorithm} comparison={comparison} />
    </div>
  );
}

function StatsBar({
  stats,
  algorithm,
  comparison,
}: {
  stats: SpanningStats | null;
  algorithm: SpanningAlgorithm;
  comparison: TreeComparison | null;
}) {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-line bg-surface px-3 py-1.5 font-mono text-xs tabular-nums">
      <Stat label="考察边" value={stats ? String(stats.checks) : '—'} />
      <Stat
        label="已收"
        value={stats ? `${stats.chosen}/${stats.needed}` : '—'}
      />
      <Stat
        label="总权重"
        value={stats ? formatDistance(stats.weight) : '—'}
        tone={stats?.done && !stats.optimal ? 'danger' : 'normal'}
      />
      <Stat label="分量" value={stats ? String(stats.components) : '—'} />
      {algorithm === 'boruvka' ? (
        <Stat
          label="轮次"
          value={stats ? `${stats.round}/${stats.totalRounds}` : '—'}
        />
      ) : null}
      {comparison ? (
        <>
          <Stat label="最短路树" value={formatDistance(comparison.weight)} />
          {comparison.worstRatio > 1 ? (
            <span className="text-danger">
              沿树绕远 ×{comparison.worstRatio.toFixed(2)}
            </span>
          ) : null}
        </>
      ) : null}
      {stats?.done && stats.components > 1 ? (
        <span className="text-danger">图不连通 · 得到的是森林</span>
      ) : null}
    </div>
  );
}

function Stat({
  label,
  value,
  tone = 'normal',
}: {
  label: string;
  value: string;
  tone?: 'normal' | 'danger';
}) {
  return (
    <span className="flex items-baseline gap-1">
      <span className="text-faint">{label}</span>
      <span className={tone === 'danger' ? 'text-danger' : 'text-ink'}>
        {value}
      </span>
    </span>
  );
}
