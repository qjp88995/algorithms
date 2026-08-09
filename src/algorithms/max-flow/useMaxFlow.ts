import { useCallback, useState } from 'react';

import { DEFAULT_SPEED, defaultConfig } from './constants';
import { buildScene, type FlowScene } from './network';
import type { FlowAlgorithm, FlowConfig, FlowPreset } from './types';

interface SceneState {
  config: FlowConfig;
  scene: FlowScene;
}

function createSceneState(config: FlowConfig): SceneState {
  return { config, scene: buildScene(config) };
}

/**
 * 最大流演示的状态中枢。
 *
 * 网络是**不可变**的：节点坐标和容量在 `buildScene` 里一次性算完，
 * 之后只读。每帧都在变的只有内核里那份流量表，那部分归画布管。
 *
 * 最小割是流跑到最大之后的副产品，切换它的显示不需要重播 ——
 * 所以它只改 config，不动 runId。
 */
export function useMaxFlow() {
  const [state, setState] = useState(() => createSceneState(defaultConfig));
  const [runId, setRunId] = useState(0);
  // 进页面直接播：这一页要看的就是三个算法找增广路的顺序差异
  const [running, setRunning] = useState(true);
  const [instant, setInstant] = useState(false);
  const [speed, setSpeed] = useState(DEFAULT_SPEED);
  const [stepId, setStepId] = useState(0);

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

  const patchConfig = useCallback((patch: Partial<FlowConfig>) => {
    setState(prev => createSceneState({ ...prev.config, ...patch }));
  }, []);

  const tweak = useCallback(
    (patch: Partial<FlowConfig>) => {
      patchConfig(patch);
      preview();
    },
    [patchConfig, preview]
  );

  const selectAlgorithm = useCallback(
    (algorithm: FlowAlgorithm) => {
      setState(prev => ({ ...prev, config: { ...prev.config, algorithm } }));
      replay();
    },
    [replay]
  );

  const selectPreset = useCallback(
    (preset: FlowPreset) => {
      patchConfig({ preset });
      replay();
    },
    [patchConfig, replay]
  );

  const reshuffle = useCallback(() => {
    patchConfig({
      preset: 'random',
      seed: Math.floor(Math.random() * 100000),
    });
    replay();
  }, [patchConfig, replay]);

  /** 割只是叠一层显示，不影响算法在算什么 —— 所以不重播 */
  const toggleCut = useCallback(() => {
    setState(prev => ({
      ...prev,
      config: { ...prev.config, showCut: !prev.config.showCut },
    }));
  }, []);

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
    config: state.config,
    scene: state.scene,
    runId,
    running,
    instant,
    speed,
    stepId,
    setSpeed,
    tweak,
    selectAlgorithm,
    selectPreset,
    reshuffle,
    toggleCut,
    play,
    pause,
    step,
    reset,
    solve: preview,
    handleFinished,
  };
}
