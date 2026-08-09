import { useCallback, useEffect, useRef, useState } from 'react';

import type { BoidsCanvasProps } from './components/BoidsCanvas';
import type { BoidsControlsProps } from './components/BoidsControls';
import {
  defaultConfig,
  MAX_FRAME_SECONDS,
  PICK_RADIUS,
  presets,
  STATS_INTERVAL,
} from './constants';
import { Flock } from './flock';
import { renderFlock } from './render';
import type {
  BoidsConfig,
  DemoStats,
  PointerInteraction,
  Steering,
} from './types';

/**
 * 把模拟内核、渲染循环和面板状态收在一个 hook 里，
 * 分别产出画布和参数面板的 props —— 这样页面可以把两块塞进
 * AlgorithmPage 的不同插槽，而它们仍共享同一份状态。
 *
 * 关键约束：rAF 循环只在挂载时建立一次。所有会被用户随手拖动的
 * 参数都通过 `liveRef` 传进循环，否则每动一下滑块就重建循环，
 * 拖尾会闪、帧率统计也会被打断。
 */
export function useBoidsSimulation(): {
  canvasProps: BoidsCanvasProps;
  controlsProps: BoidsControlsProps;
} {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const flockRef = useRef<Flock | null>(null);

  const [config, setConfig] = useState<BoidsConfig>(defaultConfig);
  const [running, setRunning] = useState(true);
  const [timeScale, setTimeScale] = useState(1);
  const [trails, setTrails] = useState(true);
  const [colorByHeading, setColorByHeading] = useState(true);
  const [focusIndex, setFocusIndex] = useState<number | null>(null);
  const [interaction, setInteraction] = useState<PointerInteraction>('repel');
  const [presetId, setPresetId] = useState('default');
  const [stats, setStats] = useState<DemoStats>({
    fps: 0,
    polarization: 0,
    averageSpeed: 0,
    averageNeighbors: 0,
  });

  // 数量调小后聚焦下标可能越界，渲染时直接推导，不额外同步 state
  const focus =
    focusIndex !== null && focusIndex < config.count ? focusIndex : null;

  const liveRef = useRef({
    config,
    running,
    timeScale,
    trails,
    colorByHeading,
    focus,
    interaction,
  });
  useEffect(() => {
    liveRef.current = {
      config,
      running,
      timeScale,
      trails,
      colorByHeading,
      focus,
      interaction,
    };
  });

  const pointerRef = useRef({ x: 0, y: 0, inside: false });
  const stepOnceRef = useRef(false);

  const patchConfig = useCallback((patch: Partial<BoidsConfig>) => {
    setConfig(prev => ({ ...prev, ...patch }));
  }, []);

  const handleResize = useCallback((width: number, height: number) => {
    if (flockRef.current) {
      flockRef.current.resize(width, height);
    } else {
      flockRef.current = new Flock({
        width,
        height,
        count: defaultConfig.count,
      });
    }
  }, []);

  // ─── 渲染循环 ───────────────────────────────────────────────
  useEffect(() => {
    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx) return;

    const scratch: Steering = {
      sepX: 0,
      sepY: 0,
      aliX: 0,
      aliY: 0,
      cohX: 0,
      cohY: 0,
      neighbors: 0,
    };

    let frame = 0;
    let last = performance.now();
    let statTimer = 0;
    let frames = 0;
    let elapsedSum = 0;

    const loop = (now: number) => {
      frame = requestAnimationFrame(loop);
      const elapsed = Math.min(MAX_FRAME_SECONDS, (now - last) / 1000);
      last = now;

      const flock = flockRef.current;
      if (!flock) return;

      const live = liveRef.current;
      const pointer = pointerRef.current;
      // 指针坐标每帧都在变，不进 React state，在这里合成进配置
      const activeConfig: BoidsConfig = {
        ...live.config,
        pointer: {
          ...live.config.pointer,
          active: live.interaction !== 'off' && pointer.inside,
          mode: live.interaction === 'attract' ? 'attract' : 'repel',
          x: pointer.x,
          y: pointer.y,
        },
      };

      if (live.running || stepOnceRef.current) {
        flock.step(elapsed * live.timeScale, activeConfig);
        stepOnceRef.current = false;
      }

      renderFlock(
        ctx,
        flock,
        activeConfig,
        {
          trails: live.trails,
          colorByHeading: live.colorByHeading,
          focusIndex: live.focus,
        },
        scratch
      );

      frames++;
      elapsedSum += elapsed;
      statTimer += elapsed;
      if (statTimer >= STATS_INTERVAL) {
        setStats({
          fps: elapsedSum > 0 ? frames / elapsedSum : 0,
          ...flock.metrics(),
        });
        statTimer = 0;
        frames = 0;
        elapsedSum = 0;
      }
    };

    frame = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(frame);
  }, []);

  // 数量变化时增减个体，不重置已有个体
  useEffect(() => {
    flockRef.current?.setCount(config.count);
  }, [config.count]);

  const handlePointerMove = useCallback((x: number, y: number) => {
    pointerRef.current.x = x;
    pointerRef.current.y = y;
    pointerRef.current.inside = true;
  }, []);

  const handlePointerLeave = useCallback(() => {
    pointerRef.current.inside = false;
  }, []);

  /** 拾取离点击位置最近的个体 */
  const handlePick = useCallback((x: number, y: number) => {
    const flock = flockRef.current;
    if (!flock) return;

    let best = -1;
    let bestDist = PICK_RADIUS * PICK_RADIUS;
    for (let i = 0; i < flock.count; i++) {
      const dx = flock.x[i] - x;
      const dy = flock.y[i] - y;
      const d2 = dx * dx + dy * dy;
      if (d2 < bestDist) {
        bestDist = d2;
        best = i;
      }
    }
    setFocusIndex(best >= 0 ? best : null);
  }, []);

  const applyPreset = useCallback(
    (id: string) => {
      const preset = presets.find(item => item.id === id);
      if (!preset) return;
      setPresetId(id);
      patchConfig(preset.patch);
    },
    [patchConfig]
  );

  return {
    canvasProps: {
      containerRef,
      canvasRef,
      onResize: handleResize,
      onPointerMove: handlePointerMove,
      onPointerLeave: handlePointerLeave,
      onPick: handlePick,
      running,
      onToggleRunning: () => setRunning(value => !value),
      onStepOnce: () => {
        stepOnceRef.current = true;
        setRunning(false);
      },
      onReset: () => {
        flockRef.current?.reset(config.count);
        setFocusIndex(null);
      },
      focusIndex: focus,
      onClearFocus: () => setFocusIndex(null),
      fps: stats.fps,
      count: config.count,
    },
    controlsProps: {
      config,
      onConfigChange: patchConfig,
      presetId,
      onPresetSelect: applyPreset,
      timeScale,
      onTimeScaleChange: setTimeScale,
      trails,
      onTrailsChange: setTrails,
      colorByHeading,
      onColorByHeadingChange: setColorByHeading,
      interaction,
      onInteractionChange: setInteraction,
      stats,
    },
  };
}
