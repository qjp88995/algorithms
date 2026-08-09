import { useEffect, useRef, useState } from 'react';

import { type ClusterRun, createRun } from '../cluster';
import { algorithmLabels, datasetLabels } from '../constants';
import type { Dataset } from '../dataset';
import { type ClusterViewport, computeViewport, renderScene } from '../render';
import type { ClusteringConfig, ClusteringStats } from '../types';

export interface ClusteringBoardProps {
  data: Dataset;
  config: ClusteringConfig;
  /** 纯展示：叠一层真实分组的描边，不影响算法 */
  showTruth: boolean;
  /** 变化即重建这一局 */
  runId: number;
  /** true 时立即算到底，用于拖滑块时实时看结果 */
  instant: boolean;
  running: boolean;
  /** 每帧走多少步 */
  speed: number;
  /** 递增即前进一步。用计数器而不是回调，rAF 循环才不用重建 */
  stepId: number;
  onFinished: () => void;
}

const STATS_INTERVAL_MS = 100;

export function ClusteringBoard({
  data,
  config,
  showTruth,
  runId,
  instant,
  running,
  speed,
  stepId,
  onFinished,
}: ClusteringBoardProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const runRef = useRef<ClusterRun | null>(null);
  const dataRef = useRef(data);
  const showTruthRef = useRef(showTruth);
  const viewRef = useRef<ClusterViewport>({
    size: 1,
    offsetX: 0,
    offsetY: 0,
    radius: 3,
  });
  const sizeRef = useRef({ width: 0, height: 0 });
  const pulseRef = useRef(0);

  const [stats, setStats] = useState<ClusteringStats | null>(null);
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
      data: dataRef.current,
      run: runRef.current,
      view: viewRef.current,
      width,
      height,
      showTruth: showTruthRef.current,
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
      viewRef.current = computeViewport(
        width,
        height,
        dataRef.current.truth.length
      );
    };

    applySize();
    const observer = new ResizeObserver(applySize);
    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  // 真值对照是纯展示，换了不重建这一局 —— 播到一半按 T 也不会打断
  useEffect(() => {
    showTruthRef.current = showTruth;
  }, [showTruth]);

  // ─── 建立/重建这一局 ────────────────────────────────────────
  // 只创建实例，不 setState：统计交给下面的循环上报，
  // 免得在 effect 里同步 setState 引发级联渲染。
  useEffect(() => {
    dataRef.current = data;
    const { width, height } = sizeRef.current;
    if (width > 0 && height > 0) {
      viewRef.current = computeViewport(width, height, data.truth.length);
    }

    const run = createRun(data, config);
    runRef.current = run;
    if (instant) run.runToEnd();
    reportedDoneRef.current = null;
    // config 里全是会改变算法结果的参数，任何一项变了都该重来一遍
  }, [data, config, runId, instant]);

  // ─── 播放循环 ───────────────────────────────────────────────
  useEffect(() => {
    let frame = 0;
    let lastStatsAt = 0;

    const loop = (now: number) => {
      frame = requestAnimationFrame(loop);
      const run = runRef.current;
      const live = liveRef.current;
      if (!run) return;

      pulseRef.current++;

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
          {algorithmLabels[config.algorithm].label}
        </span>
        <span className="font-mono text-xs text-faint">
          {algorithmLabels[config.algorithm].complexity}
        </span>
        <span className="ml-auto text-xs text-faint">
          {datasetLabels[config.dataset].label} · {data.truth.length} 点
        </span>
      </div>

      <div ref={containerRef} className="relative min-h-0 flex-1">
        <canvas ref={canvasRef} className="block size-full touch-none" />
      </div>

      <StatsBar stats={stats} hasTruth={data.groups > 0} />
    </div>
  );
}

function StatsBar({
  stats,
  hasTruth,
}: {
  stats: ClusteringStats | null;
  hasTruth: boolean;
}) {
  const agreement = stats?.agreement ?? 0;
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-line bg-surface px-3 py-1.5 font-mono text-xs tabular-nums">
      <Stat label="簇" value={stats ? String(stats.clusters) : '—'} />
      <Stat label="噪声" value={stats ? String(stats.noise) : '—'} />
      <Stat label="步数" value={stats ? String(stats.steps) : '—'} />
      <Stat
        label="簇内平方和"
        value={stats ? stats.inertia.toFixed(2) : '—'}
        hint="K-means 优化的就是这个数"
      />
      {hasTruth ? (
        <span className="flex items-baseline gap-1">
          <span className="text-faint">吻合度</span>
          <span
            className={
              stats?.done && agreement < 0.5 ? 'text-danger' : 'text-ink'
            }
          >
            {stats ? agreement.toFixed(2) : '—'}
          </span>
        </span>
      ) : (
        <span className="text-faint">这份数据没有真实分组</span>
      )}
      {stats ? <span className="text-faint">{stats.phase}</span> : null}
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
