import { useEffect, useRef } from 'react';

import { renderProfile } from '../render';
import type { ProfileSample } from '../types';

export interface ArrivalProfileProps {
  samples: ProfileSample[];
  departure: number;
}

/**
 * 「几点出发 → 要走多久」的一天曲线。
 *
 * 这条曲线是这一页真正的主角：单看一次搜索，只知道这一趟花了多久；
 * 把一天扫一遍，早晚高峰的两个鼓包、以及施工造成的那道断崖，
 * 才在同一张图上同时可见。红色的段落是 FIFO 违例 ——
 * 晚出发一分钟，到得反而更早。
 */
export function ArrivalProfile({ samples, departure }: ArrivalProfileProps) {
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
      renderProfile(ctx, { samples, departure, width, height });
    };

    paint();
    const observer = new ResizeObserver(paint);
    observer.observe(container);
    return () => observer.disconnect();
  }, [samples, departure]);

  return (
    <div className="mt-3 flex h-28 shrink-0 flex-col overflow-hidden rounded-xl border border-line bg-canvas">
      <div className="flex items-baseline gap-2 border-b border-line px-3 py-1.5">
        <span className="text-xs font-medium">到达曲线</span>
        <span className="font-mono text-xs text-faint">
          几点出发 → 路上要花多少分钟
        </span>
        <span className="ml-auto text-xs text-faint">
          红色段落 = 晚出发反而早到（FIFO 违例）
        </span>
      </div>
      <div ref={containerRef} className="relative min-h-0 flex-1">
        <canvas ref={canvasRef} className="block size-full" />
      </div>
    </div>
  );
}
