import { useCallback, useRef, useState } from 'react';

import {
  comparedAlgorithms,
  DEFAULT_COLS,
  DEFAULT_SPEED,
  rowsFor,
} from './constants';
import type { RunnerAlgorithm } from './runner';

/**
 * 走迷宫页的状态中枢。
 *
 * 迷宫由 `seed` + 尺寸唯一决定，四块画布各自生成同一张 —— 对比四种走法
 * 必须走同一个迷宫，否则比的是运气。走法自己的随机性由派生种子提供。
 */
export function useMazeRunner() {
  const [algorithm, setAlgorithm] = useState<RunnerAlgorithm>('wall-follower');
  const [cols, setCols] = useState(DEFAULT_COLS);
  const [seed, setSeed] = useState(1);
  const [speed, setSpeed] = useState(DEFAULT_SPEED);
  const [compare, setCompare] = useState(false);
  /** 迷雾：关掉就是上帝视角，用来和寻路页做对照 */
  const [fog, setFog] = useState(true);
  const [running, setRunning] = useState(true);
  const [instant, setInstant] = useState(false);
  const [runId, setRunId] = useState(0);
  const [stepId, setStepId] = useState(0);

  const finishedRef = useRef(0);

  const restart = useCallback(() => {
    finishedRef.current = 0;
    setRunId(id => id + 1);
  }, []);

  const replay = useCallback(() => {
    setInstant(false);
    setRunning(true);
    restart();
  }, [restart]);

  const selectAlgorithm = useCallback(
    (value: RunnerAlgorithm) => {
      setAlgorithm(value);
      replay();
    },
    [replay]
  );

  const reseed = useCallback(() => {
    setSeed(value => value + 1);
    replay();
  }, [replay]);

  const toggleCompare = useCallback(
    (value: boolean) => {
      setCompare(value);
      replay();
    },
    [replay]
  );

  // 拖尺寸滑块要即时反馈，直接走完给结果
  const changeCols = useCallback(
    (value: number) => {
      setCols(value);
      setRunning(false);
      setInstant(true);
      restart();
    },
    [restart]
  );

  const play = useCallback(() => replay(), [replay]);
  const pause = useCallback(() => setRunning(false), []);

  const step = useCallback(() => {
    setRunning(false);
    setInstant(false);
    setStepId(id => id + 1);
  }, []);

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

  const handleFinished = useCallback(() => {
    finishedRef.current += 1;
    const boards = compare ? comparedAlgorithms.length : 1;
    if (finishedRef.current >= boards) setRunning(false);
  }, [compare]);

  return {
    algorithm,
    cols,
    rows: rowsFor(cols),
    seed,
    runId,
    stepId,
    running,
    instant,
    speed,
    compare,
    fog,
    selectAlgorithm,
    setSpeed,
    setCols: changeCols,
    setCompare: toggleCompare,
    setFog,
    reseed,
    play,
    pause,
    step,
    reset,
    solve,
    handleFinished,
  };
}
