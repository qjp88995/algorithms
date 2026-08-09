import {
  type PointerEvent as ReactPointerEvent,
  type RefObject,
  useEffect,
} from 'react';

import { Crosshair, Pause, Play, RotateCcw, SkipForward } from 'lucide-react';

import { ActionButton } from '@/components/controls';
import { cn } from '@/lib/cn';

import { forceColors } from '../constants';

export interface BoidsCanvasProps {
  containerRef: RefObject<HTMLDivElement | null>;
  canvasRef: RefObject<HTMLCanvasElement | null>;
  /** 画布尺寸变化时回调，由外层同步给模拟内核 */
  onResize: (width: number, height: number) => void;
  onPointerMove: (x: number, y: number) => void;
  onPointerLeave: () => void;
  onPick: (x: number, y: number) => void;
  running: boolean;
  onToggleRunning: () => void;
  onStepOnce: () => void;
  onReset: () => void;
  focusIndex: number | null;
  onClearFocus: () => void;
  fps: number;
  count: number;
}

/**
 * 只负责画布这一块：尺寸自适应、指针交互、底部工具条。
 * 画什么由外层的渲染循环决定，这里不碰模拟数据。
 */
export function BoidsCanvas({
  containerRef,
  canvasRef,
  onResize,
  onPointerMove,
  onPointerLeave,
  onPick,
  running,
  onToggleRunning,
  onStepOnce,
  onReset,
  focusIndex,
  onClearFocus,
  fps,
  count,
}: BoidsCanvasProps) {
  // 画布尺寸跟随容器，并按 DPR 缩放绘图坐标系
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
      // 缩放后续绘制一律用 CSS 像素坐标
      canvas.getContext('2d')?.setTransform(dpr, 0, 0, dpr, 0, 0);
      onResize(width, height);
    };

    applySize();
    const observer = new ResizeObserver(applySize);
    observer.observe(container);
    return () => observer.disconnect();
  }, [containerRef, canvasRef, onResize]);

  const toLocal = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    return { x: event.clientX - rect.left, y: event.clientY - rect.top };
  };

  return (
    <div className="flex min-h-100 flex-1 flex-col overflow-hidden rounded-xl border border-line bg-canvas">
      <div ref={containerRef} className="relative min-h-0 flex-1">
        <canvas
          ref={canvasRef}
          className="block size-full cursor-crosshair touch-none"
          onPointerMove={event => {
            const { x, y } = toLocal(event);
            onPointerMove(x, y);
          }}
          onPointerLeave={onPointerLeave}
          onPointerDown={event => {
            const { x, y } = toLocal(event);
            onPick(x, y);
          }}
        />
        {focusIndex !== null ? (
          <div className="pointer-events-none absolute top-3 left-3 flex flex-col gap-1 rounded-lg bg-surface/85 px-3 py-2 text-xs">
            <span className="text-muted">
              聚焦 #{focusIndex} —— 箭头为该个体此刻受到的三个转向力
            </span>
            <div className="flex flex-wrap gap-3">
              <Legend color={forceColors.separation} label="分离" />
              <Legend color={forceColors.alignment} label="对齐" />
              <Legend color={forceColors.cohesion} label="聚合" />
            </div>
          </div>
        ) : (
          <span className="pointer-events-none absolute top-3 left-3 rounded-lg bg-surface/85 px-3 py-2 text-xs text-faint">
            点击任意一只鸟，查看它的视野和受力
          </span>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2 border-t border-line bg-surface px-3 py-2">
        <ActionButton variant="primary" onClick={onToggleRunning}>
          {running ? <Pause /> : <Play />}
          {running ? '暂停' : '继续'}
        </ActionButton>
        <ActionButton onClick={onStepOnce}>
          <SkipForward />
          单帧
        </ActionButton>
        <ActionButton onClick={onReset}>
          <RotateCcw />
          重新撒点
        </ActionButton>
        <ActionButton
          onClick={onClearFocus}
          disabled={focusIndex === null}
          className={cn(focusIndex === null && 'opacity-40')}
        >
          <Crosshair />
          取消聚焦
        </ActionButton>
        <span className="ml-auto font-mono text-xs text-faint tabular-nums">
          {fps.toFixed(0)} fps · {count} 只
        </span>
      </div>
    </div>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5 text-muted">
      <span
        className="size-2 rounded-full"
        style={{ backgroundColor: color }}
      />
      {label}
    </span>
  );
}
