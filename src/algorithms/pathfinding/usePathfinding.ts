import { useCallback, useRef, useState } from 'react';

import type { DragKind } from './components/PathfindingBoard';
import {
  comparedAlgorithms,
  DEFAULT_COLS,
  DEFAULT_ROWS,
  DEFAULT_SPEED,
  defaultConfig,
} from './constants';
import { clearTerrain, createGrid, setSwamp, setWall } from './grid';
import { generateMaze, scatterObstacles } from './maze';
import type { Brush, SearchAlgorithm, SearchConfig } from './types';

/**
 * 寻路演示的状态中枢。
 *
 * 网格是一份可变的 typed array，不进 React state —— 拖着鼠标画墙时
 * 每帧都在改，克隆一份的开销毫无意义。这里把 ref 本身交给画布，
 * 渲染期间不解引用（只在事件和 effect 里读 .current），
 * 地形改动通过递增 `runId` 通知画布重建搜索。
 *
 * `instant` 决定重建后是直接算到底还是等着播放：不在播放动画时，
 * 拖动墙壁能实时看到新路径；点了播放才逐帧展开。
 */
export function usePathfinding() {
  const gridRef = useRef(createGrid(DEFAULT_COLS, DEFAULT_ROWS));
  const [config, setConfig] = useState<SearchConfig>(defaultConfig);
  const [runId, setRunId] = useState(0);
  // 进页面直接播一遍：这个页面的重点就是看搜索怎么扩张，
  // 一上来给个静态结果等于把最有意思的部分藏起来了
  const [running, setRunning] = useState(true);
  const [instant, setInstant] = useState(false);
  const [speed, setSpeed] = useState(DEFAULT_SPEED);
  const [brush, setBrush] = useState<Brush>('wall');
  const [compare, setCompare] = useState(false);

  /** 对比模式下有四块画布，要等它们都跑完才算这一轮结束 */
  const finishedRef = useRef(0);

  const restart = useCallback(() => {
    finishedRef.current = 0;
    setRunId(id => id + 1);
  }, []);

  const patchConfig = useCallback((patch: Partial<SearchConfig>) => {
    setConfig(prev => ({ ...prev, ...patch }));
    // 调滑块时要的是即时反馈，直接给结果
    setRunning(false);
    setInstant(true);
  }, []);

  /** 换算法则重新播一遍 —— 不同算法怎么扩张正是这页要看的东西 */
  const selectAlgorithm = useCallback(
    (algorithm: SearchAlgorithm) => {
      setConfig(prev => ({ ...prev, algorithm }));
      setInstant(false);
      setRunning(true);
      restart();
    },
    [restart]
  );

  const toggleCompare = useCallback(
    (value: boolean) => {
      setCompare(value);
      setInstant(false);
      setRunning(true);
      restart();
    },
    [restart]
  );

  /** 画笔落到某一格：画墙/沼泽、擦除，或拖动起终点 */
  const paint = useCallback(
    (index: number, kind: DragKind) => {
      const grid = gridRef.current;
      if (kind === 'start') {
        if (index === grid.goal || grid.walls[index] === 1) return;
        if (grid.start === index) return;
        grid.start = index;
      } else if (kind === 'goal') {
        if (index === grid.start || grid.walls[index] === 1) return;
        if (grid.goal === index) return;
        grid.goal = index;
      } else if (kind === 'erase') {
        if (grid.walls[index] === 0 && grid.weights[index] === 1) return;
        setWall(grid, index, false);
        setSwamp(grid, index, false);
      } else {
        if (index === grid.start || index === grid.goal) return;
        if (brush === 'erase') {
          if (grid.walls[index] === 0 && grid.weights[index] === 1) return;
          setWall(grid, index, false);
          setSwamp(grid, index, false);
        } else if (brush === 'swamp') {
          if (grid.weights[index] > 1) return;
          setSwamp(grid, index, true);
        } else {
          if (grid.walls[index] === 1) return;
          setWall(grid, index, true);
        }
      }

      // 编辑地形时不打断正在播放的动画，否则永远看不完一次搜索
      if (!running) setInstant(true);
      restart();
    },
    [brush, restart, running]
  );

  const play = useCallback(() => {
    setInstant(false);
    setRunning(true);
    restart();
  }, [restart]);

  const pause = useCallback(() => setRunning(false), []);

  const reset = useCallback(() => {
    setRunning(false);
    setInstant(false);
    restart();
  }, [restart]);

  const solve = useCallback(() => {
    setRunning(false);
    setInstant(true);
    restart();
  }, [restart]);

  const rebuildTerrain = useCallback(
    (build: () => void) => {
      build();
      setInstant(false);
      setRunning(true);
      restart();
    },
    [restart]
  );

  const buildMaze = useCallback(
    () => rebuildTerrain(() => generateMaze(gridRef.current)),
    [rebuildTerrain]
  );

  const buildRandom = useCallback(
    () => rebuildTerrain(() => scatterObstacles(gridRef.current, 0.28, 0.35)),
    [rebuildTerrain]
  );

  const clearAll = useCallback(
    () => rebuildTerrain(() => clearTerrain(gridRef.current)),
    [rebuildTerrain]
  );

  const handleFinished = useCallback(() => {
    finishedRef.current += 1;
    const boards = compare ? comparedAlgorithms.length : 1;
    if (finishedRef.current >= boards) setRunning(false);
  }, [compare]);

  return {
    gridRef,
    config,
    runId,
    running,
    instant,
    speed,
    brush,
    compare,
    patchConfig,
    selectAlgorithm,
    setSpeed,
    setBrush,
    setCompare: toggleCompare,
    paint,
    play,
    pause,
    reset,
    solve,
    buildMaze,
    buildRandom,
    clearAll,
    handleFinished,
  };
}
