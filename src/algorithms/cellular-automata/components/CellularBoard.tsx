import {
  type PointerEvent as ReactPointerEvent,
  type RefObject,
  useEffect,
} from 'react';

import {
  Eraser,
  Pause,
  Play,
  RotateCcw,
  Shuffle,
  SkipForward,
} from 'lucide-react';

import { ActionButton } from '@/components/controls';

import { findPattern } from '../patterns';
import type { CellularConfig, ElementaryStats, LifeStats } from '../types';

export interface CellularBoardProps {
  containerRef: RefObject<HTMLDivElement | null>;
  canvasRef: RefObject<HTMLCanvasElement | null>;
  config: CellularConfig;
  dims: { cols: number; rows: number };
  running: boolean;
  stats: LifeStats;
  elementaryStats: ElementaryStats;
  fps: number;
  patternId: string | null;
  onResize: (width: number, height: number) => void;
  onPointerDown: (x: number, y: number) => void;
  onPointerMove: (x: number, y: number) => void;
  onPointerUp: () => void;
  onPointerLeave: () => void;
  onToggleRunning: () => void;
  onStep: () => void;
  onReset: () => void;
  onClear: () => void;
  onRandomize: () => void;
  onReseed: () => void;
}

/**
 * 画布这一块：尺寸自适应、格子级的指针交互、底部读数条。
 * 画什么由 hook 里的循环决定，这里不碰模拟数据。
 */
export function CellularBoard({
  containerRef,
  canvasRef,
  config,
  dims,
  running,
  stats,
  elementaryStats,
  fps,
  patternId,
  onResize,
  onPointerDown,
  onPointerMove,
  onPointerUp,
  onPointerLeave,
  onToggleRunning,
  onStep,
  onReset,
  onClear,
  onRandomize,
  onReseed,
}: CellularBoardProps) {
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
      onResize(width, height);
    };

    applySize();
    const observer = new ResizeObserver(applySize);
    observer.observe(container);
    return () => observer.disconnect();
  }, [containerRef, canvasRef, onResize]);

  const toCell = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    return {
      x: Math.floor((event.clientX - rect.left) / config.cellSize),
      y: Math.floor((event.clientY - rect.top) / config.cellSize),
    };
  };

  const is2d = config.dimension === '2d';
  const held = patternId ? findPattern(patternId) : undefined;

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border border-line bg-canvas">
      <div ref={containerRef} className="relative min-h-0 flex-1">
        <canvas
          ref={canvasRef}
          className="block size-full touch-none"
          style={{ cursor: is2d ? 'crosshair' : 'default' }}
          onPointerDown={event => {
            if (!is2d) return;
            event.currentTarget.setPointerCapture(event.pointerId);
            const { x, y } = toCell(event);
            onPointerDown(x, y);
          }}
          onPointerMove={event => {
            const { x, y } = toCell(event);
            onPointerMove(x, y);
          }}
          onPointerUp={onPointerUp}
          onPointerLeave={onPointerLeave}
        />
        <span className="pointer-events-none absolute top-3 left-3 rounded-lg bg-surface/85 px-3 py-2 text-xs text-faint">
          {is2d
            ? held
              ? `点击画布放下「${held.label}」`
              : '在画布上拖动可以画格子，点活格是擦'
            : '每一行是一代，时间从上往下流'}
        </span>
      </div>

      <div className="flex flex-wrap items-center gap-2 border-t border-line bg-surface px-3 py-2">
        <ActionButton
          variant="primary"
          onClick={onToggleRunning}
          title={running ? '暂停（Space）' : '继续（Space）'}
        >
          {running ? <Pause /> : <Play />}
          {running ? '暂停' : '继续'}
        </ActionButton>
        <ActionButton onClick={onStep} title="推进一代（S）">
          <SkipForward />
          单步
        </ActionButton>
        <ActionButton onClick={onReset} title="回到初始格局（R）">
          <RotateCcw />
          重置
        </ActionButton>
        {is2d ? (
          <>
            <ActionButton onClick={onClear} title="清空画布（C）">
              <Eraser />
              清空
            </ActionButton>
            <ActionButton onClick={onRandomize} title="随机撒点（G）">
              <Shuffle />
              随机撒点
            </ActionButton>
          </>
        ) : (
          <ActionButton onClick={onReseed} title="重新播种（G）">
            <Shuffle />
            重新播种
          </ActionButton>
        )}

        <span className="ml-auto font-mono text-xs text-faint tabular-nums">
          {is2d ? (
            <>
              第 {stats.generation} 代 · {stats.population} 活 ·{' '}
              <span className="text-muted">{statusText(stats)}</span> ·{' '}
              {dims.cols}×{dims.rows} · {fps.toFixed(0)} fps
            </>
          ) : (
            <>
              第 {elementaryStats.generation} 代 · {elementaryStats.population}{' '}
              活 · 宽 {dims.cols} · {fps.toFixed(0)} fps
            </>
          )}
        </span>
      </div>
    </div>
  );
}

function statusText(stats: LifeStats) {
  switch (stats.status.kind) {
    case 'extinct':
      return '全灭';
    case 'still':
      return '静止';
    case 'cycle':
      return `周期 ${stats.status.period}`;
    default:
      return `活跃 ${stats.changed}`;
  }
}
