import { useCallback, useMemo, useState } from 'react';

import { DEFAULT_SPEED, defaultConfig } from './constants';
import { buildGrid } from './grid';
import type { Dir, TurnConfig, TurnCosts, TurnGrid, TurnStats } from './types';

interface GridState {
  config: TurnConfig;
  grid: TurnGrid;
}

function createGridState(config: TurnConfig): GridState {
  return { config, grid: buildGrid(config) };
}

/**
 * 转弯代价演示的状态中枢。
 *
 * 地图和代价分得很开：改密度或换图要重铺地形，而调转弯价钱只是换一组
 * 边权，地图一动不动 —— 这样拖动「转弯代价」滑块时，三条路线是在
 * **同一张图上**此消彼长，对比才成立。
 */
export function useTurnCost() {
  const [state, setState] = useState(() => createGridState(defaultConfig));
  const [runId, setRunId] = useState(0);
  const [running, setRunning] = useState(true);
  const [instant, setInstant] = useState(false);
  const [speed, setSpeed] = useState(DEFAULT_SPEED);
  const [stepId, setStepId] = useState(0);
  const [showStates, setShowStates] = useState(true);
  /** 画布跑出来的读数，账单表和统计栏共用一份 */
  const [stats, setStats] = useState<TurnStats | null>(null);

  const costs = useMemo<TurnCosts>(
    () => ({ turn: state.config.turnCost, uTurn: state.config.uTurnCost }),
    [state.config.turnCost, state.config.uTurnCost]
  );

  const replay = useCallback(() => {
    setInstant(false);
    setRunning(true);
    setRunId(id => id + 1);
  }, []);

  const preview = useCallback(() => {
    setRunning(false);
    setInstant(true);
    setRunId(id => id + 1);
  }, []);

  /** 改代价：地图不动，只换边权 */
  const setCost = useCallback(
    (patch: Partial<TurnConfig>) => {
      setState(prev => ({ ...prev, config: { ...prev.config, ...patch } }));
      preview();
    },
    [preview]
  );

  /** 改地形：整张图重铺 */
  const rebuild = useCallback(
    (patch: Partial<TurnConfig>) => {
      setState(prev => createGridState({ ...prev.config, ...patch }));
      preview();
    },
    [preview]
  );

  const reshuffle = useCallback(() => {
    setState(prev =>
      createGridState({
        ...prev.config,
        seed: Math.floor(Math.random() * 100000),
      })
    );
    replay();
  }, [replay]);

  const setStartDir = useCallback(
    (startDir: Dir) => setCost({ startDir }),
    [setCost]
  );

  /** 点画布上的空地就把终点搬过去；地形不变，不用重铺 */
  const pickGoal = useCallback(
    (cell: number) => {
      setState(prev => {
        if (cell === prev.grid.goal || prev.grid.walls[cell] === 1) return prev;
        if (cell === prev.grid.start) return prev;
        return { ...prev, grid: { ...prev.grid, goal: cell } };
      });
      preview();
    },
    [preview]
  );

  const pause = useCallback(() => setRunning(false), []);

  const step = useCallback(() => {
    setRunning(false);
    setInstant(false);
    setStepId(id => id + 1);
  }, []);

  const reset = useCallback(() => {
    setRunning(false);
    setInstant(false);
    setRunId(id => id + 1);
  }, []);

  const handleFinished = useCallback(() => setRunning(false), []);
  const handleStats = useCallback((next: TurnStats) => setStats(next), []);

  return {
    config: state.config,
    grid: state.grid,
    costs,
    stats,
    runId,
    running,
    instant,
    speed,
    stepId,
    showStates,
    setSpeed,
    setShowStates,
    setCost,
    rebuild,
    reshuffle,
    setStartDir,
    pickGoal,
    play: replay,
    pause,
    step,
    reset,
    solve: preview,
    handleFinished,
    handleStats,
  };
}
