import { useEffect, useRef, useState } from 'react';

import { computeGraphViewport, type GraphViewport } from '@/lib/graph/geometry';
import { nodeName } from '@/lib/graph/model';

import { algorithmLabels, FLASH_FRAMES } from '../constants';
import { MaxFlowRun } from '../flow';
import type { FlowScene } from '../network';
import { format, renderScene } from '../render';
import type { FlowAlgorithm, FlowStats } from '../types';

export interface MaxFlowBoardProps {
  scene: FlowScene;
  algorithm: FlowAlgorithm;
  /** 跑完之后画出最小割；只影响画面，不影响算法 */
  showCut: boolean;
  /** 变化即重建这一局 */
  runId: number;
  /** true 时立即算到底，用于拖滑块时实时看结果 */
  instant: boolean;
  running: boolean;
  /** 每帧考察多少条边 */
  speed: number;
  /** 递增即前进一步。用计数器而不是回调，rAF 循环才不用重建 */
  stepId: number;
  onFinished: () => void;
}

const STATS_INTERVAL_MS = 100;

export function MaxFlowBoard({
  scene,
  algorithm,
  showCut,
  runId,
  instant,
  running,
  speed,
  stepId,
  onFinished,
}: MaxFlowBoardProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const runRef = useRef<MaxFlowRun | null>(null);
  const sceneRef = useRef(scene);
  const showCutRef = useRef(showCut);
  const viewRef = useRef<GraphViewport>({
    scaleX: 1,
    scaleY: 1,
    offsetX: 0,
    offsetY: 0,
    radius: 12,
  });
  const sizeRef = useRef({ width: 0, height: 0 });
  /** 刚推完那条增广路的余晖剩余帧数 */
  const flashRef = useRef(0);
  const lastPathRef = useRef<number[]>([]);
  const pulseRef = useRef(0);

  const [stats, setStats] = useState<FlowStats | null>(null);
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
      showCut: showCutRef.current,
      flash: flashRef.current,
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

  // 割是纯展示，换了不重建这一局 —— 播到一半按 C 也不会打断
  useEffect(() => {
    showCutRef.current = showCut;
  }, [showCut]);

  // ─── 建立/重建这一局 ────────────────────────────────────────
  // 只创建实例，不 setState：统计交给下面的循环上报，
  // 免得在 effect 里同步 setState 引发级联渲染。
  useEffect(() => {
    sceneRef.current = scene;
    const { width, height } = sizeRef.current;
    if (width > 0 && height > 0) {
      viewRef.current = computeGraphViewport(scene.graph, width, height);
    }

    const run = new MaxFlowRun(scene, algorithm);
    runRef.current = run;
    flashRef.current = 0;
    lastPathRef.current = run.lastPath;
    if (instant) run.runToEnd();
    reportedDoneRef.current = null;
  }, [scene, algorithm, runId, instant]);

  // ─── 播放循环 ───────────────────────────────────────────────
  useEffect(() => {
    let frame = 0;
    let lastStatsAt = 0;

    /** 走一步；推成了一条增广路就点亮余晖 */
    const advance = (run: MaxFlowRun) => {
      run.step();
      // 每次增广都换一个新数组，引用变了就是推过一条路
      if (run.lastPath !== lastPathRef.current) {
        lastPathRef.current = run.lastPath;
        flashRef.current = FLASH_FRAMES;
      }
    };

    const loop = (now: number) => {
      frame = requestAnimationFrame(loop);
      const run = runRef.current;
      const live = liveRef.current;
      if (!run) return;

      pulseRef.current++;
      if (flashRef.current > 0) flashRef.current--;

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
          {nodeName(scene.source)} ⇒ {nodeName(scene.sink)}
        </span>
      </div>

      <div ref={containerRef} className="relative min-h-0 flex-1">
        <canvas ref={canvasRef} className="block size-full touch-none" />
      </div>

      <StatsBar stats={stats} algorithm={algorithm} maxFlow={scene.maxFlow} />
    </div>
  );
}

function StatsBar({
  stats,
  algorithm,
  maxFlow,
}: {
  stats: FlowStats | null;
  algorithm: FlowAlgorithm;
  maxFlow: number;
}) {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-line bg-surface px-3 py-1.5 font-mono text-xs tabular-nums">
      <Stat
        label="流量"
        value={stats ? `${format(stats.value)}/${format(maxFlow)}` : '—'}
      />
      <Stat label="增广" value={stats ? String(stats.augmentations) : '—'} />
      <Stat label="考察边" value={stats ? String(stats.checks) : '—'} />
      {algorithm === 'dinic' ? (
        <Stat label="相位" value={stats ? String(stats.phase) : '—'} />
      ) : null}
      {stats?.done ? (
        <Stat
          label="最小割"
          value={`${format(stats.cutCapacity)} · ${stats.cutEdges} 条`}
        />
      ) : null}
      {stats?.usedReverse && !stats.done ? (
        <span className="text-accent">这条路在退货 · 走了反向边</span>
      ) : null}
      {stats?.done && !stats.optimal ? (
        <span className="text-danger">没跑到最大流</span>
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
