import { useCallback, useEffect, useRef, useState } from 'react';

import { seededRandom } from '@/lib/random';

import {
  CYCLE_WINDOW,
  defaultConfig,
  INITIAL_PATTERN,
  INITIAL_PATTERN_AT,
} from './constants';
import { ElementaryCA } from './elementary';
import { classify, CycleDetector, LifeGrid } from './life';
import { findPattern } from './patterns';
import { CellularRenderer } from './render';
import type {
  CellularConfig,
  ElementaryStats,
  LifeRule,
  LifeStats,
  LifeStatus,
} from './types';

/** 统计刷新的间隔（秒）—— 每帧 setState 会把面板拖垮 */
const STATS_INTERVAL = 0.15;
/** 掉帧时最多补几代，否则卡一下就会跳过一大段演化 */
const MAX_STEPS_PER_FRAME = 4;
/** 单帧最长按 0.1 秒算，标签页切回来时不至于瞬间冲过去几百代 */
const MAX_FRAME_SECONDS = 0.1;

const emptyStats: LifeStats = {
  generation: 0,
  population: 0,
  changed: 0,
  status: { kind: 'running' },
};

/**
 * 元胞自动机的状态中枢。
 *
 * 两套内核（二维 Life-like 和一维初等 CA）共用一个 rAF 循环和一块画布 ——
 * 它们本来就是同一件事的两个切面，切维度不该是切页面。
 *
 * 循环仍然只在挂载时建立一次，所有随手会拖的参数走 `liveRef`。
 * 这里比 boids 多一层：模拟按**代**推进而不是按时间积分，所以循环里
 * 用 `carry` 累积「这一帧欠了几代」，速度调到 60 代/秒也不会因为
 * 帧长抖动而忽快忽慢。
 */
export function useCellularAutomata() {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const gridRef = useRef<LifeGrid | null>(null);
  const caRef = useRef<ElementaryCA | null>(null);
  const rendererRef = useRef<CellularRenderer | null>(null);
  const detectorRef = useRef(new CycleDetector(CYCLE_WINDOW));

  const sizeRef = useRef({ width: 0, height: 0 });
  const statusRef = useRef<LifeStatus>({ kind: 'running' });
  const stepOnceRef = useRef(false);
  /** 鼠标所在的格子，以及画笔状态 */
  const pointerRef = useRef<{
    cell: { x: number; y: number } | null;
    painting: boolean;
    brush: boolean;
  }>({ cell: null, painting: false, brush: true });

  const [config, setConfig] = useState<CellularConfig>(defaultConfig);
  const [running, setRunning] = useState(true);
  const [patternId, setPatternId] = useState<string | null>(null);
  const [dims, setDims] = useState({ cols: 0, rows: 0 });
  const [stats, setStats] = useState<LifeStats>(emptyStats);
  const [elementaryStats, setElementaryStats] = useState<ElementaryStats>({
    generation: 0,
    population: 0,
  });
  const [fps, setFps] = useState(0);

  const liveRef = useRef({ config, running, patternId });
  useEffect(() => {
    liveRef.current = { config, running, patternId };
  });

  /** 按当前画布尺寸和格子边长决定网格规模；内容尽量保留 */
  const syncSize = useCallback(() => {
    const { width, height } = sizeRef.current;
    if (width === 0 || height === 0) return;
    const { cellSize } = liveRef.current.config;
    const cols = Math.max(8, Math.floor(width / cellSize));
    const rows = Math.max(8, Math.floor(height / cellSize));

    const grid = gridRef.current;
    if (!grid) {
      const fresh = new LifeGrid(cols, rows);
      const pattern = findPattern(INITIAL_PATTERN);
      // 第一次拿到尺寸就把招牌图案摆上：空白画布讲不出任何事
      if (pattern) {
        fresh.stamp(pattern, INITIAL_PATTERN_AT.x, INITIAL_PATTERN_AT.y);
      }
      gridRef.current = fresh;
    } else {
      grid.resize(cols, rows);
    }

    const ca = caRef.current;
    if (!ca) {
      const fresh = new ElementaryCA(cols, rows);
      fresh.seedSingle();
      caRef.current = fresh;
    } else {
      ca.resize(cols, rows);
      if (liveRef.current.config.seed === 'random') {
        ca.seedRandom(liveRef.current.config.density, seededRandom(1));
      } else {
        ca.seedSingle();
      }
    }

    detectorRef.current.reset();
    statusRef.current = { kind: 'running' };
    setDims({ cols, rows });
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

  // ─── 渲染循环 ───────────────────────────────────────────────
  useEffect(() => {
    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx) return;
    rendererRef.current ??= new CellularRenderer();

    let frame = 0;
    let last = performance.now();
    let carry = 0;
    let statTimer = 0;
    let frames = 0;
    let elapsedSum = 0;

    const loop = (now: number) => {
      frame = requestAnimationFrame(loop);
      const elapsed = Math.min(MAX_FRAME_SECONDS, (now - last) / 1000);
      last = now;

      const grid = gridRef.current;
      const ca = caRef.current;
      const renderer = rendererRef.current;
      if (!grid || !ca || !renderer) return;

      const {
        config: live,
        running: isRunning,
        patternId: heldPattern,
      } = liveRef.current;

      let steps = 0;
      if (isRunning) {
        carry += elapsed * live.speed;
        steps = Math.min(MAX_STEPS_PER_FRAME, Math.floor(carry));
        carry -= steps;
      } else if (stepOnceRef.current) {
        steps = 1;
        carry = 0;
      }
      stepOnceRef.current = false;

      for (let k = 0; k < steps; k++) {
        if (live.dimension === '2d') {
          grid.step(live.rule, live.edge);
          const period = detectorRef.current.push(
            grid.cells,
            grid.generation,
            grid.hash()
          );
          statusRef.current = classify(grid.population, grid.changed, period);
        } else {
          ca.step(live.ruleNumber);
        }
      }

      if (live.dimension === '2d') {
        const pattern = heldPattern ? findPattern(heldPattern) : undefined;
        const cell = pointerRef.current.cell;
        renderer.drawLife(ctx, grid, {
          width: sizeRef.current.width,
          height: sizeRef.current.height,
          cellSize: live.cellSize,
          ageColoring: live.ageColoring,
          decayTrails: live.decayTrails,
          showGrid: live.showGrid,
          ghost: pattern && cell ? { pattern, x: cell.x, y: cell.y } : null,
        });
      } else {
        renderer.drawElementary(ctx, ca, {
          width: sizeRef.current.width,
          height: sizeRef.current.height,
          cellSize: live.cellSize,
          showGrid: live.showGrid,
        });
      }

      frames++;
      elapsedSum += elapsed;
      statTimer += elapsed;
      if (statTimer >= STATS_INTERVAL) {
        setFps(elapsedSum > 0 ? frames / elapsedSum : 0);
        setStats({
          generation: grid.generation,
          population: grid.population,
          changed: grid.changed,
          status: statusRef.current,
        });
        setElementaryStats({
          generation: ca.generation,
          population: ca.population,
        });
        statTimer = 0;
        frames = 0;
        elapsedSum = 0;
      }
    };

    frame = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(frame);
  }, []);

  // ─── 编辑 ───────────────────────────────────────────────────
  /** 用户一动手，之前测到的周期就作废了 */
  const invalidate = useCallback(() => {
    detectorRef.current.reset();
    statusRef.current = { kind: 'running' };
  }, []);

  const handlePointerDown = useCallback(
    (x: number, y: number) => {
      const grid = gridRef.current;
      if (!grid || liveRef.current.config.dimension !== '2d') return;
      if (x >= grid.cols || y >= grid.rows) return;

      const id = liveRef.current.patternId;
      const pattern = id ? findPattern(id) : undefined;
      if (pattern) {
        grid.stamp(pattern, x, y, liveRef.current.config.edge);
        setPatternId(null);
        invalidate();
        return;
      }

      // 点在活格上就是擦，点在空格上就是画，之后整段拖动都用这一支笔
      const brush = grid.get(x, y) === 0;
      pointerRef.current.painting = true;
      pointerRef.current.brush = brush;
      grid.set(x, y, brush);
      invalidate();
    },
    [invalidate]
  );

  const handlePointerMove = useCallback((x: number, y: number) => {
    pointerRef.current.cell = { x, y };
    const grid = gridRef.current;
    if (!grid || !pointerRef.current.painting) return;
    if (x >= grid.cols || y >= grid.rows) return;
    grid.set(x, y, pointerRef.current.brush);
  }, []);

  const handlePointerUp = useCallback(() => {
    pointerRef.current.painting = false;
  }, []);

  const handlePointerLeave = useCallback(() => {
    pointerRef.current.painting = false;
    pointerRef.current.cell = null;
  }, []);

  // ─── 动作 ───────────────────────────────────────────────────
  const patch = useCallback((next: Partial<CellularConfig>) => {
    setConfig(prev => ({ ...prev, ...next }));
  }, []);

  const clear = useCallback(() => {
    gridRef.current?.clear();
    invalidate();
  }, [invalidate]);

  const randomize = useCallback(() => {
    const grid = gridRef.current;
    if (!grid) return;
    grid.randomize(
      liveRef.current.config.density,
      seededRandom(Math.floor(Math.random() * 100000))
    );
    invalidate();
    setRunning(true);
  }, [invalidate]);

  /** 一维那边「重来」就是重新播种，二维是回到刚进页面的样子 */
  const reseed = useCallback(() => {
    const ca = caRef.current;
    if (!ca) return;
    if (liveRef.current.config.seed === 'random') {
      ca.seedRandom(
        liveRef.current.config.density,
        seededRandom(Math.floor(Math.random() * 100000))
      );
    } else {
      ca.seedSingle();
    }
  }, []);

  const reset = useCallback(() => {
    if (liveRef.current.config.dimension === '1d') {
      reseed();
      return;
    }
    const grid = gridRef.current;
    if (!grid) return;
    grid.clear();
    const pattern = findPattern(INITIAL_PATTERN);
    if (pattern) {
      grid.stamp(pattern, INITIAL_PATTERN_AT.x, INITIAL_PATTERN_AT.y);
    }
    invalidate();
  }, [invalidate, reseed]);

  const step = useCallback(() => {
    setRunning(false);
    stepOnceRef.current = true;
  }, []);

  const toggleRunning = useCallback(() => setRunning(value => !value), []);

  const selectRule = useCallback(
    (rule: LifeRule) => {
      patch({ rule });
      invalidate();
    },
    [invalidate, patch]
  );

  const selectRuleNumber = useCallback(
    (ruleNumber: number) => {
      patch({ ruleNumber });
      reseed();
    },
    [patch, reseed]
  );

  const selectDimension = useCallback(
    (dimension: CellularConfig['dimension']) => {
      patch({ dimension });
      if (dimension === '1d') reseed();
    },
    [patch, reseed]
  );

  const selectSeed = useCallback((seed: CellularConfig['seed']) => {
    setConfig(prev => ({ ...prev, seed }));
    // patch 是异步的，播种要用刚选的这个值
    const ca = caRef.current;
    if (!ca) return;
    if (seed === 'random') {
      ca.seedRandom(
        liveRef.current.config.density,
        seededRandom(Math.floor(Math.random() * 100000))
      );
    } else {
      ca.seedSingle();
    }
  }, []);

  const selectPattern = useCallback((id: string | null) => {
    setPatternId(prev => (prev === id ? null : id));
  }, []);

  return {
    containerRef,
    canvasRef,
    config,
    dims,
    running,
    stats,
    elementaryStats,
    fps,
    patternId,
    patch,
    onResize: handleResize,
    onPointerDown: handlePointerDown,
    onPointerMove: handlePointerMove,
    onPointerUp: handlePointerUp,
    onPointerLeave: handlePointerLeave,
    clear,
    randomize,
    reseed,
    reset,
    step,
    toggleRunning,
    selectRule,
    selectRuleNumber,
    selectDimension,
    selectSeed,
    selectPattern,
  };
}
