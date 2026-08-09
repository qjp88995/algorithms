import {
  type PointerEvent as ReactPointerEvent,
  type RefObject,
  useEffect,
} from 'react';

import { Eraser, Pause, Play, RotateCcw, SkipForward } from 'lucide-react';

import { ActionButton } from '@/components/controls';

import { MATERIALS } from '../materials';
import type { SandConfig, SandStats } from '../types';

export interface SandBoardProps {
  containerRef: RefObject<HTMLDivElement | null>;
  canvasRef: RefObject<HTMLCanvasElement | null>;
  config: SandConfig;
  grid: { cols: number; rows: number; cellSize: number };
  running: boolean;
  stats: SandStats;
  fps: number;
  onResize: (width: number, height: number) => void;
  onPointerDown: (x: number, y: number) => void;
  onPointerMove: (x: number, y: number) => void;
  onPointerUp: () => void;
  onPointerLeave: () => void;
  onToggleRunning: () => void;
  onStep: () => void;
  onReset: () => void;
  onClear: () => void;
}

/**
 * 画布这一块：尺寸自适应、像素级的笔刷交互、底部读数条。
 * 画什么由 hook 里的循环决定，这里不碰模拟数据。
 */
export function SandBoard({
  containerRef,
  canvasRef,
  config,
  grid,
  running,
  stats,
  fps,
  onResize,
  onPointerDown,
  onPointerMove,
  onPointerUp,
  onPointerLeave,
  onToggleRunning,
  onStep,
  onReset,
  onClear,
}: SandBoardProps) {
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
    const size = grid.cellSize || 1;
    return {
      x: Math.floor((event.clientX - rect.left) / size),
      y: Math.floor((event.clientY - rect.top) / size),
    };
  };

  const held = MATERIALS[config.material];
  const skipped = stats.totalChunks - stats.activeChunks;

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border border-line bg-canvas">
      <div ref={containerRef} className="relative min-h-0 flex-1">
        <canvas
          ref={canvasRef}
          className="block size-full cursor-crosshair touch-none"
          onPointerDown={event => {
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
        <span className="pointer-events-none absolute top-3 left-3 flex items-center gap-2 rounded-lg bg-surface/85 px-3 py-2 text-xs text-faint">
          <span
            className="size-3 shrink-0 rounded-sm ring-1 ring-line"
            style={{ background: held.color }}
          />
          按住左键喷「{held.name}」· 数字键换材质 ·{' '}
          <kbd className="font-mono">[</kbd> <kbd className="font-mono">]</kbd>{' '}
          调笔刷
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
        <ActionButton onClick={onStep} title="推进一帧（S）">
          <SkipForward />
          单步
        </ActionButton>
        <ActionButton onClick={onReset} title="重摆当前场景（R）">
          <RotateCcw />
          重置
        </ActionButton>
        <ActionButton onClick={onClear} title="清空画布（C）">
          <Eraser />
          清空
        </ActionButton>

        <span className="ml-auto font-mono text-xs text-faint tabular-nums">
          {stats.filled.toLocaleString()} 格 ·{' '}
          <span className="text-muted">
            活跃块 {stats.activeChunks}/{stats.totalChunks}
          </span>
          {stats.totalChunks > 0 ? (
            <span className="text-muted">
              （省下 {Math.round((skipped / stats.totalChunks) * 100)}%）
            </span>
          ) : null}{' '}
          · {grid.cols}×{grid.rows} · {fps.toFixed(0)} fps
        </span>
      </div>
    </div>
  );
}
