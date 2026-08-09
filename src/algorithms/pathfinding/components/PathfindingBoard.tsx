import {
  type PointerEvent as ReactPointerEvent,
  type RefObject,
  useEffect,
  useRef,
  useState,
} from 'react';

import { algorithmLabels } from '../constants';
import { isWall } from '../grid';
import { cellAt, computeViewport, renderGrid, type Viewport } from '../render';
import { PathSearch } from '../search';
import type { GridModel, SearchConfig, SearchStats } from '../types';

/** 拖拽的语义在按下那一刻就定下来，之后整段拖拽都按它执行 */
export type DragKind = 'draw' | 'erase' | 'start' | 'goal';

export interface PathfindingBoardProps {
  /** 传 ref 而不是网格本身：网格内容是可变的，渲染期间不该读它 */
  gridRef: RefObject<GridModel>;
  config: SearchConfig;
  /** 变化即重建搜索：地形被编辑、参数被改动、用户点了重置 */
  runId: number;
  /** true 时立即算到底，用于拖拽地形时实时看到结果 */
  instant: boolean;
  running: boolean;
  /** 每帧展开的节点数 */
  speed: number;
  onPaint: (index: number, kind: DragKind) => void;
  onFinished: () => void;
  /** 对比模式下每块画布顶部标出算法名 */
  title?: string;
}

const STATS_INTERVAL_MS = 100;

export function PathfindingBoard({
  gridRef,
  config,
  runId,
  instant,
  running,
  speed,
  onPaint,
  onFinished,
  title,
}: PathfindingBoardProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const searchRef = useRef<PathSearch | null>(null);
  const pathRef = useRef<number[]>([]);
  const viewportRef = useRef<Viewport>({
    cellSize: 1,
    offsetX: 0,
    offsetY: 0,
  });
  const sizeRef = useRef({ width: 0, height: 0 });
  const dragRef = useRef<DragKind | null>(null);
  const dirtyRef = useRef(true);

  const [stats, setStats] = useState<SearchStats | null>(null);
  /** 上一次上报统计时的完成状态，null 表示这一轮还没上报过 */
  const reportedDoneRef = useRef<boolean | null>(null);

  // 播放参数和回调都放进 ref，rAF 循环才能只建立一次
  const liveRef = useRef({ running, speed, onFinished });
  useEffect(() => {
    liveRef.current = { running, speed, onFinished };
  });

  const draw = () => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    const grid = gridRef.current;
    const { width, height } = sizeRef.current;
    if (width === 0 || height === 0) return;
    renderGrid(
      ctx,
      grid,
      searchRef.current,
      pathRef.current,
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
  }, [gridRef]);

  // ─── 建立/重建搜索 ──────────────────────────────────────────
  // 这里只创建实例，不 setState：统计由下面的循环在检测到状态变化时上报，
  // 避免 effect 里同步 setState 引发级联渲染。
  useEffect(() => {
    const search = new PathSearch(gridRef.current, config);
    searchRef.current = search;
    if (instant) {
      search.runToEnd();
      pathRef.current = search.path();
    } else {
      pathRef.current = [];
    }
    reportedDoneRef.current = null;
    dirtyRef.current = true;
  }, [gridRef, config, runId, instant]);

  // ─── 播放循环 ───────────────────────────────────────────────
  useEffect(() => {
    let frame = 0;
    let lastStatsAt = 0;

    const loop = (now: number) => {
      frame = requestAnimationFrame(loop);
      const search = searchRef.current;
      const live = liveRef.current;
      if (!search) return;

      const wasRunning = live.running && !search.done;
      if (wasRunning) {
        search.advance(live.speed);
        dirtyRef.current = true;
      }

      // 刚建好的搜索、或刚跑完的那一帧，都要把统计推给界面
      const settled = reportedDoneRef.current !== search.done;
      if (settled && search.done) {
        pathRef.current = search.path();
        dirtyRef.current = true;
        if (wasRunning) live.onFinished();
      }
      if (settled || (wasRunning && now - lastStatsAt > STATS_INTERVAL_MS)) {
        reportedDoneRef.current = search.done;
        setStats(search.stats());
        lastStatsAt = now;
      }

      if (dirtyRef.current) {
        draw();
        dirtyRef.current = false;
      }
    };

    frame = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(frame);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 循环只建立一次，可变量走 liveRef
  }, []);

  const pickCell = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    return cellAt(
      gridRef.current,
      viewportRef.current,
      event.clientX - rect.left,
      event.clientY - rect.top
    );
  };

  const handleDown = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    const index = pickCell(event);
    if (index < 0) return;
    event.currentTarget.setPointerCapture(event.pointerId);

    // 按在端点上就是拖端点，否则按落点当前状态决定这次是画还是擦
    const grid = gridRef.current;
    if (index === grid.start) dragRef.current = 'start';
    else if (index === grid.goal) dragRef.current = 'goal';
    else dragRef.current = isWall(grid, index) ? 'erase' : 'draw';

    onPaint(index, dragRef.current);
  };

  const handleMove = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    if (!dragRef.current) return;
    const index = pickCell(event);
    if (index < 0) return;
    onPaint(index, dragRef.current);
  };

  const endDrag = () => {
    dragRef.current = null;
  };

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-xl border border-line bg-canvas">
      {title ? (
        <div className="flex items-baseline gap-2 border-b border-line px-3 py-1.5">
          <span className="text-xs font-medium">{title}</span>
          <span className="font-mono text-xs text-faint">
            key = {algorithmLabels[config.algorithm].key}
          </span>
        </div>
      ) : null}

      <div ref={containerRef} className="relative min-h-0 flex-1">
        <canvas
          ref={canvasRef}
          className="block size-full cursor-crosshair touch-none"
          onPointerDown={handleDown}
          onPointerMove={handleMove}
          onPointerUp={endDrag}
          onPointerCancel={endDrag}
        />
      </div>

      <StatsBar stats={stats} />
    </div>
  );
}

function StatsBar({ stats }: { stats: SearchStats | null }) {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-line bg-surface px-3 py-1.5 font-mono text-xs tabular-nums">
      <Stat label="展开" value={stats ? String(stats.expanded) : '—'} />
      <Stat label="边界" value={stats ? String(stats.frontier) : '—'} />
      <Stat
        label="代价"
        value={stats?.found ? stats.pathCost.toFixed(1) : '—'}
      />
      <Stat
        label="步数"
        value={stats?.found ? String(stats.pathLength - 1) : '—'}
      />
      {stats?.done && !stats.found ? (
        <span className="text-danger">无解</span>
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
