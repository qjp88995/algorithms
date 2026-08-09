import {
  type PointerEvent as ReactPointerEvent,
  useEffect,
  useRef,
} from 'react';

import { frontierHitTest, renderFrontier } from '../render';
import type { CostPoint, ParetoSolution } from '../types';

export interface CostSpaceProps {
  samples: CostPoint[];
  solutions: ParetoSolution[];
  selected: number;
  best: number;
  lambda: number;
  onSelect: (index: number) => void;
}

/**
 * 代价空间：一个点就是一条路，横轴是时间，纵轴是过路费。
 *
 * 画布上看的是「路怎么走」，这里看的是「代价长什么样」——
 * 同一批解的两个视图。帕累托前沿在这张图上是那团灰点的左下边界，
 * 而金色虚线（当前偏好的等权重线）无论怎么转，永远只停在凸包的角上。
 */
export function CostSpace({
  samples,
  solutions,
  selected,
  best,
  lambda,
  onSelect,
}: CostSpaceProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    const canvas = canvasRef.current;
    if (!container || !canvas) return;

    const paint = () => {
      const { width, height } = container.getBoundingClientRect();
      if (width === 0 || height === 0) return;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      renderFrontier(ctx, {
        samples,
        solutions,
        selected,
        best,
        lambda,
        width,
        height,
      });
    };

    paint();
    const observer = new ResizeObserver(paint);
    observer.observe(container);
    return () => observer.disconnect();
  }, [samples, solutions, selected, best, lambda]);

  const handleClick = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const index = frontierHitTest(
      {
        samples,
        solutions,
        selected,
        best,
        lambda,
        width: rect.width,
        height: rect.height,
      },
      event.clientX - rect.left,
      event.clientY - rect.top
    );
    if (index >= 0) onSelect(index);
  };

  return (
    <div className="mt-3 flex h-40 shrink-0 flex-col overflow-hidden rounded-xl border border-line bg-canvas">
      <div className="flex items-baseline gap-2 border-b border-line px-3 py-1.5">
        <span className="text-xs font-medium">代价空间</span>
        <span className="font-mono text-xs text-faint">
          一个点 = 一条路 · 点它可以选中
        </span>
        <span className="ml-auto text-xs text-faint">
          金色虚线 = 当前偏好的等权重线
        </span>
      </div>
      <div ref={containerRef} className="relative min-h-0 flex-1">
        <canvas
          ref={canvasRef}
          className="block size-full cursor-pointer touch-none"
          onPointerDown={handleClick}
        />
      </div>
    </div>
  );
}
