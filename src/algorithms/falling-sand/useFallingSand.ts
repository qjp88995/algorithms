import { useCallback, useEffect, useRef, useState } from 'react';

import {
  defaultConfig,
  INITIAL_SCENE,
  MAX_BRUSH,
  MAX_CELLS,
  MAX_STEPS_PER_FRAME,
  MIN_BRUSH,
} from './constants';
import { SandRenderer } from './render';
import { SandWorld } from './sand';
import { findScene } from './scenes';
import type { SandConfig, SandOptions, SandStats } from './types';

/** 统计刷新的间隔（秒）—— 每帧 setState 会把面板拖垮 */
const STATS_INTERVAL = 0.15;

const emptyStats: SandStats = {
  frame: 0,
  filled: 0,
  activeChunks: 0,
  totalChunks: 0,
  scanned: 0,
  moved: 0,
};

/**
 * 落沙页的状态中枢。
 *
 * 和其它演示页一样：rAF 循环只在挂载时建立一次，所有随手会拖的参数
 * 走 `liveRef`；网格是原地修改的 `Uint8Array`，全程待在 ref 里 ——
 * 十几万格每帧都在变，克隆一份进 state 毫无意义。
 *
 * 只有一处是这一页特有的：**按住不放就持续注水**。笔刷不是「按下时画一次」
 * 而是每帧都往世界里注一笔，于是拖着水龙头浇的手感是免费拿到的。
 */
export function useFallingSand() {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const worldRef = useRef<SandWorld | null>(null);
  const rendererRef = useRef<SandRenderer | null>(null);
  const sizeRef = useRef({ width: 0, height: 0 });
  /** 实际生效的格子边长。循环里读不了 state，而它和 `grid.cellSize` 同源 */
  const cellSizeRef = useRef(defaultConfig.cellSize);
  const stepOnceRef = useRef(false);
  /** 笔刷状态：是否按着、在哪一格、上一帧在哪一格 */
  const pointerRef = useRef<{
    painting: boolean;
    cell: { x: number; y: number } | null;
    last: { x: number; y: number } | null;
  }>({ painting: false, cell: null, last: null });
  /** 每帧都要传给内核，做成常驻对象免得每帧新分配 */
  const optionsRef = useRef<SandOptions>({
    useChunks: defaultConfig.useChunks,
    alternateScan: defaultConfig.alternateScan,
    bottomUp: defaultConfig.bottomUp,
    liquidSpread: defaultConfig.liquidSpread,
  });

  const [config, setConfig] = useState<SandConfig>(defaultConfig);
  const [running, setRunning] = useState(true);
  const [sceneId, setSceneId] = useState(INITIAL_SCENE);
  const [grid, setGrid] = useState({ cols: 0, rows: 0, cellSize: 0 });
  const [stats, setStats] = useState<SandStats>(emptyStats);
  const [fps, setFps] = useState(0);

  const liveRef = useRef({ config, running, sceneId });
  useEffect(() => {
    liveRef.current = { config, running, sceneId };
  });

  /**
   * 按画布尺寸和格子边长定网格规模。
   *
   * 格子边长会被往上顶：cellSize 拉到 2 时超大屏能凑出三十多万格，
   * 单线程 JS 到那个量级就掉帧了。宁可格子画大一点，也不要一卡一卡的。
   */
  const syncSize = useCallback(() => {
    const { width, height } = sizeRef.current;
    if (width === 0 || height === 0) return;

    const requested = liveRef.current.config.cellSize;
    const floor = Math.ceil(Math.sqrt((width * height) / MAX_CELLS));
    const cellSize = Math.max(requested, floor);
    const cols = Math.max(32, Math.floor(width / cellSize));
    const rows = Math.max(32, Math.floor(height / cellSize));

    const world = worldRef.current;
    if (!world) {
      const fresh = new SandWorld(cols, rows, 20_250_809);
      findScene(liveRef.current.sceneId)?.build(fresh);
      worldRef.current = fresh;
    } else {
      world.resize(cols, rows);
    }
    cellSizeRef.current = cellSize;
    setGrid({ cols, rows, cellSize });
  }, []);

  const handleResize = useCallback(
    (width: number, height: number) => {
      sizeRef.current = { width, height };
      syncSize();
    },
    [syncSize]
  );

  useEffect(() => {
    syncSize();
  }, [config.cellSize, syncSize]);

  useEffect(() => {
    optionsRef.current.useChunks = config.useChunks;
    optionsRef.current.alternateScan = config.alternateScan;
    optionsRef.current.bottomUp = config.bottomUp;
    optionsRef.current.liquidSpread = config.liquidSpread;
  }, [
    config.useChunks,
    config.alternateScan,
    config.bottomUp,
    config.liquidSpread,
  ]);

  // ─── 渲染循环 ───────────────────────────────────────────────
  useEffect(() => {
    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx) return;
    rendererRef.current ??= new SandRenderer();

    let frame = 0;
    let last = performance.now();
    // 「这一帧欠了几步」的累积。模拟按步推进而不是按时间积分，
    // 靠它把步数和帧率解耦 —— 速度调到 2 步/秒也不会因帧长抖动而忽快忽慢
    let carry = 0;
    let statTimer = 0;
    let frames = 0;
    let elapsedSum = 0;

    const loop = (now: number) => {
      frame = requestAnimationFrame(loop);
      const elapsed = Math.min(0.1, (now - last) / 1000);
      last = now;

      const world = worldRef.current;
      const renderer = rendererRef.current;
      if (!world || !renderer) return;

      const { config: live, running: isRunning } = liveRef.current;
      const pointer = pointerRef.current;

      // 按住不放 = 持续注入。放在推进之前，这一笔当帧就参与模拟
      if (pointer.painting && pointer.cell) {
        world.paint(
          pointer.cell.x,
          pointer.cell.y,
          live.brushSize,
          live.material
        );
      }

      if (isRunning) {
        carry += elapsed * live.speed;
        const steps = Math.min(MAX_STEPS_PER_FRAME, Math.floor(carry));
        carry -= steps;
        for (let k = 0; k < steps; k++) world.step(optionsRef.current);
      } else if (stepOnceRef.current) {
        world.step(optionsRef.current);
        carry = 0;
      }
      stepOnceRef.current = false;

      renderer.draw(ctx, world, {
        width: sizeRef.current.width,
        height: sizeRef.current.height,
        cellSize: cellSizeRef.current,
        showChunks: live.showChunks,
        brush: pointer.cell
          ? { x: pointer.cell.x, y: pointer.cell.y, radius: live.brushSize }
          : null,
      });

      frames++;
      elapsedSum += elapsed;
      statTimer += elapsed;
      if (statTimer >= STATS_INTERVAL) {
        setFps(elapsedSum > 0 ? frames / elapsedSum : 0);
        setStats(world.stats());
        statTimer = 0;
        frames = 0;
        elapsedSum = 0;
      }
    };

    frame = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(frame);
  }, []);

  // ─── 笔刷 ───────────────────────────────────────────────────
  /**
   * 两点之间补一条线。
   *
   * 只在指针事件到达的格子上画的话，鼠标一甩就是一串断点 ——
   * 浏览器的 pointermove 频率跟不上手速，中间那些格子从来没被报告过。
   */
  const stroke = useCallback(
    (from: { x: number; y: number } | null, to: { x: number; y: number }) => {
      const world = worldRef.current;
      if (!world) return;
      const { brushSize, material } = liveRef.current.config;
      if (!from) {
        world.paint(to.x, to.y, brushSize, material);
        return;
      }
      const dx = to.x - from.x;
      const dy = to.y - from.y;
      const steps = Math.max(Math.abs(dx), Math.abs(dy));
      for (let k = 0; k <= steps; k++) {
        const t = steps === 0 ? 0 : k / steps;
        world.paint(
          Math.round(from.x + dx * t),
          Math.round(from.y + dy * t),
          brushSize,
          material
        );
      }
    },
    []
  );

  const handlePointerDown = useCallback(
    (x: number, y: number) => {
      pointerRef.current.painting = true;
      pointerRef.current.cell = { x, y };
      pointerRef.current.last = { x, y };
      stroke(null, { x, y });
    },
    [stroke]
  );

  const handlePointerMove = useCallback(
    (x: number, y: number) => {
      const pointer = pointerRef.current;
      pointer.cell = { x, y };
      if (!pointer.painting) return;
      stroke(pointer.last, { x, y });
      pointer.last = { x, y };
    },
    [stroke]
  );

  const handlePointerUp = useCallback(() => {
    pointerRef.current.painting = false;
    pointerRef.current.last = null;
  }, []);

  const handlePointerLeave = useCallback(() => {
    pointerRef.current.painting = false;
    pointerRef.current.cell = null;
    pointerRef.current.last = null;
  }, []);

  // ─── 动作 ───────────────────────────────────────────────────
  const patch = useCallback((next: Partial<SandConfig>) => {
    setConfig(prev => ({ ...prev, ...next }));
  }, []);

  const buildScene = useCallback((id: string) => {
    const world = worldRef.current;
    if (!world) return;
    world.clear();
    findScene(id)?.build(world);
  }, []);

  const selectScene = useCallback(
    (id: string) => {
      setSceneId(id);
      buildScene(id);
      setRunning(true);
    },
    [buildScene]
  );

  const reset = useCallback(() => {
    buildScene(liveRef.current.sceneId);
  }, [buildScene]);

  const clear = useCallback(() => {
    worldRef.current?.clear();
  }, []);

  const step = useCallback(() => {
    setRunning(false);
    stepOnceRef.current = true;
  }, []);

  const toggleRunning = useCallback(() => setRunning(value => !value), []);

  const selectMaterial = useCallback(
    (material: number) => patch({ material }),
    [patch]
  );

  const nudgeBrush = useCallback(
    (delta: number) => {
      const next = liveRef.current.config.brushSize + delta;
      patch({ brushSize: Math.min(MAX_BRUSH, Math.max(MIN_BRUSH, next)) });
    },
    [patch]
  );

  return {
    containerRef,
    canvasRef,
    config,
    grid,
    running,
    sceneId,
    stats,
    fps,
    patch,
    onResize: handleResize,
    onPointerDown: handlePointerDown,
    onPointerMove: handlePointerMove,
    onPointerUp: handlePointerUp,
    onPointerLeave: handlePointerLeave,
    selectScene,
    selectMaterial,
    nudgeBrush,
    reset,
    clear,
    step,
    toggleRunning,
  };
}
