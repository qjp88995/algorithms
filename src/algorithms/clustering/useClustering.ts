import { useCallback, useMemo, useState } from 'react';

import { datasetLabels, DEFAULT_SPEED, defaultConfig } from './constants';
import { buildDataset } from './dataset';
import type { ClusterAlgorithm, ClusteringConfig, DatasetKind } from './types';

/**
 * 聚类演示的状态中枢。
 *
 * 数据是**不可变**的：坐标在 `buildDataset` 里一次性算完，之后只读。
 * 每帧都在变的只有内核里那份标签表，那部分归画布管。
 *
 * 真值对照只是叠一层描边，切它不需要重播；换数据集则会连带换上一组
 * 「能用」的参数 —— 否则一切过去满屏都是噪声，看到的是参数没调，
 * 而不是算法的脾气。
 */
export function useClustering() {
  const [config, setConfig] = useState<ClusteringConfig>(defaultConfig);
  const [runId, setRunId] = useState(0);
  // 进页面直接播：默认就是 K-means 配月牙，那一幕值得自动演一遍
  const [running, setRunning] = useState(true);
  const [instant, setInstant] = useState(false);
  const [speed, setSpeed] = useState(DEFAULT_SPEED);
  const [stepId, setStepId] = useState(0);
  // 纯展示，不进 config —— 切它不该重建内核，也就不会打断动画
  const [showTruth, setShowTruth] = useState(false);

  const data = useMemo(
    () => buildDataset(config.dataset, config.pointCount, config.seed),
    [config.dataset, config.pointCount, config.seed]
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

  const tweak = useCallback(
    (patch: Partial<ClusteringConfig>) => {
      setConfig(prev => ({ ...prev, ...patch }));
      preview();
    },
    [preview]
  );

  const selectAlgorithm = useCallback(
    (algorithm: ClusterAlgorithm) => {
      setConfig(prev => ({ ...prev, algorithm }));
      replay();
    },
    [replay]
  );

  /** 换数据集时带上它的推荐参数，随时可以自己再拖坏 */
  const selectDataset = useCallback(
    (dataset: DatasetKind) => {
      const { k, eps } = datasetLabels[dataset];
      setConfig(prev => ({ ...prev, dataset, k, eps }));
      replay();
    },
    [replay]
  );

  const reshuffle = useCallback(() => {
    setConfig(prev => ({
      ...prev,
      seed: Math.floor(Math.random() * 100000),
    }));
    replay();
  }, [replay]);

  /** 数据一个点都不动，只重挑一次 K-means 的初始中心 */
  const rollInit = useCallback(() => {
    setConfig(prev => ({
      ...prev,
      initSeed: Math.floor(Math.random() * 100000),
    }));
    replay();
  }, [replay]);

  const toggleTruth = useCallback(() => setShowTruth(value => !value), []);

  const toggleSmartInit = useCallback(() => {
    setConfig(prev => ({ ...prev, smartInit: !prev.smartInit }));
    replay();
  }, [replay]);

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
    setRunId(id => id + 1);
  }, []);

  const handleFinished = useCallback(() => setRunning(false), []);

  return {
    config,
    data,
    showTruth,
    runId,
    running,
    instant,
    speed,
    stepId,
    setSpeed,
    tweak,
    selectAlgorithm,
    selectDataset,
    reshuffle,
    rollInit,
    toggleTruth,
    toggleSmartInit,
    play,
    pause,
    step,
    reset,
    solve: preview,
    handleFinished,
  };
}
