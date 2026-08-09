import { useCallback, useRef, useState } from 'react';

import { comparedAlgorithms, DEFAULT_SIZE, DEFAULT_SPEED } from './constants';
import type { Distribution } from './data';
import type { SortAlgorithm } from './sorter';

/**
 * 排序页的状态中枢。
 *
 * 和迷宫生成页同构：数组本身不在这里 —— 六个算法各自原地改自己那一份，
 * 这里只发参数（算法、元素个数、分布、种子）和播放指令。
 * 参数一样就一定生成同一个数组，所以对比模式下六块画布排的是同一批数据，
 * 比的才是算法。
 */
export function useSorting() {
  const [algorithm, setAlgorithm] = useState<SortAlgorithm>('quick');
  const [size, setSize] = useState(DEFAULT_SIZE);
  const [distribution, setDistribution] = useState<Distribution>('random');
  const [seed, setSeed] = useState(1);
  const [speed, setSpeed] = useState(DEFAULT_SPEED);
  const [compare, setCompare] = useState(false);
  // 进页面直接开排：这一页的全部看点就是"过程"
  const [running, setRunning] = useState(true);
  const [instant, setInstant] = useState(false);
  const [runId, setRunId] = useState(0);
  const [stepId, setStepId] = useState(0);

  /** 对比模式下有六块画布，要等它们都排完才算这一轮结束 */
  const finishedRef = useRef(0);

  const restart = useCallback(() => {
    finishedRef.current = 0;
    setRunId(id => id + 1);
  }, []);

  /** 从头再排一遍 */
  const replay = useCallback(() => {
    setInstant(false);
    setRunning(true);
    restart();
  }, [restart]);

  /** 换数据：重新发牌，但先别急着开跑 —— 让人看清初始分布长什么样 */
  const reload = useCallback(() => {
    setInstant(false);
    setRunning(false);
    restart();
  }, [restart]);

  const selectAlgorithm = useCallback(
    (value: SortAlgorithm) => {
      setAlgorithm(value);
      replay();
    },
    [replay]
  );

  const selectDistribution = useCallback(
    (value: Distribution) => {
      setDistribution(value);
      reload();
    },
    [reload]
  );

  const changeSize = useCallback(
    (value: number) => {
      setSize(value);
      reload();
    },
    [reload]
  );

  const reseed = useCallback(() => {
    setSeed(value => value + 1);
    reload();
  }, [reload]);

  const toggleCompare = useCallback(
    (value: boolean) => {
      setCompare(value);
      replay();
    },
    [replay]
  );

  const play = useCallback(() => {
    setInstant(false);
    setRunning(true);
  }, []);
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

  /** 跳过过程直接看结果 —— 主要是为了对比六边的最终统计 */
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
    size,
    distribution,
    seed,
    runId,
    stepId,
    running,
    instant,
    speed,
    compare,
    selectAlgorithm,
    setSpeed,
    setSize: changeSize,
    setDistribution: selectDistribution,
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
