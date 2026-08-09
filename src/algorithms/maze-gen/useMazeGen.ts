import { useCallback, useRef, useState } from 'react';

import type { MazeAlgorithm } from '@/lib/maze/generators';

import {
  comparedAlgorithms,
  DEFAULT_COLS,
  DEFAULT_SPEED,
  rowsFor,
} from './constants';

/**
 * 迷宫生成页的状态中枢。
 *
 * 和寻路那个 hook 的关键区别：网格不在这里。四种算法长出的是四张
 * 不同的迷宫，所以网格归各块画布自己持有，这里只发参数
 * （算法、尺寸、种子）和播放指令。
 *
 * `seed` 让"同一张迷宫"可复现：对比模式下四块板共用一个种子，
 * 比较的才是长法而不是运气。
 */
export function useMazeGen() {
  const [algorithm, setAlgorithm] = useState<MazeAlgorithm>('backtracker');
  const [cols, setCols] = useState(DEFAULT_COLS);
  const [seed, setSeed] = useState(1);
  const [speed, setSpeed] = useState(DEFAULT_SPEED);
  const [compare, setCompare] = useState(false);
  // 进页面直接播一遍：这一页的全部看点就是"怎么长出来的"
  const [running, setRunning] = useState(true);
  const [instant, setInstant] = useState(false);
  const [runId, setRunId] = useState(0);
  const [stepId, setStepId] = useState(0);

  /** 对比模式下有四块画布，要等它们都跑完才算这一轮结束 */
  const finishedRef = useRef(0);

  const restart = useCallback(() => {
    finishedRef.current = 0;
    setRunId(id => id + 1);
  }, []);

  /** 从头再长一遍 */
  const replay = useCallback(() => {
    setInstant(false);
    setRunning(true);
    restart();
  }, [restart]);

  const selectAlgorithm = useCallback(
    (value: MazeAlgorithm) => {
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

  // 拖尺寸滑块要的是即时反馈，直接给结果，别每动一格就重播一遍动画
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
    selectAlgorithm,
    setSpeed,
    setCols: changeCols,
    setCompare: toggleCompare,
    reseed,
    play,
    pause,
    step,
    reset,
    solve,
    handleFinished,
  };
}
