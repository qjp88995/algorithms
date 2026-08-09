import { useCallback, useState } from 'react';

import { DEFAULT_SPEED, defaultConfig } from './constants';
import { buildScene, type ShortestScene } from './scene';
import type { Endpoint, ShortestAlgorithm, ShortestConfig } from './types';

interface SceneState {
  config: ShortestConfig;
  scene: ShortestScene;
  source: number;
  target: number;
}

function createSceneState(config: ShortestConfig): SceneState {
  const scene = buildScene(config);
  return { config, scene, source: scene.source, target: scene.target };
}

/**
 * 最短路径演示的状态中枢。
 *
 * 和网格寻路不同，这里的图是**不可变**的：一局的节点坐标和边权在
 * `buildScene` 里一次性算完，之后只读。所以它就是普通的 state，不需要
 * ref —— 每帧都在变的只有搜索内核自己的距离表，那部分归画布管。
 *
 * 改参数时分两种反馈：换算法、换图、开负环要重新播一遍（过程才是重点），
 * 拖滑块则直接给结果（要的是即时反馈）。
 */
export function useShortestPath() {
  const [state, setState] = useState(() => createSceneState(defaultConfig));
  const [runId, setRunId] = useState(0);
  // 进页面直接播：这一页要看的就是三个算法检查边的顺序差异
  const [running, setRunning] = useState(true);
  const [instant, setInstant] = useState(false);
  const [speed, setSpeed] = useState(DEFAULT_SPEED);
  const [stepId, setStepId] = useState(0);
  const [endpoint, setEndpoint] = useState<Endpoint>('target');

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

  /** 改图的参数一律重建场景；节点数没变就留住用户挑的端点 */
  const patchConfig = useCallback((patch: Partial<ShortestConfig>) => {
    setState(prev => {
      const config = { ...prev.config, ...patch };
      const scene = buildScene(config);
      const keep = config.nodeCount === prev.config.nodeCount;
      return {
        config,
        scene,
        source: keep ? prev.source : scene.source,
        target: keep ? prev.target : scene.target,
      };
    });
  }, []);

  const tweak = useCallback(
    (patch: Partial<ShortestConfig>) => {
      patchConfig(patch);
      preview();
    },
    [patchConfig, preview]
  );

  const selectAlgorithm = useCallback(
    (algorithm: ShortestAlgorithm) => {
      setState(prev => ({ ...prev, config: { ...prev.config, algorithm } }));
      replay();
    },
    [replay]
  );

  const reshuffle = useCallback(() => {
    patchConfig({ seed: Math.floor(Math.random() * 100000) });
    replay();
  }, [patchConfig, replay]);

  const toggleNegativeCycle = useCallback(() => {
    setState(prev => {
      const config = {
        ...prev.config,
        negativeCycle: !prev.config.negativeCycle,
      };
      return { ...prev, config, scene: buildScene(config) };
    });
    replay();
  }, [replay]);

  /** 点击节点：按当前"点击设为"把它设成起点或终点 */
  const pickNode = useCallback(
    (node: number) => {
      setState(prev => {
        if (endpoint === 'source') {
          if (node === prev.source || node === prev.target) return prev;
          return { ...prev, source: node };
        }
        if (node === prev.target || node === prev.source) return prev;
        return { ...prev, target: node };
      });
      preview();
    },
    [endpoint, preview]
  );

  const swapEndpoints = useCallback(() => {
    setState(prev => ({ ...prev, source: prev.target, target: prev.source }));
    preview();
  }, [preview]);

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
    source: state.source,
    target: state.target,
    runId,
    running,
    instant,
    speed,
    stepId,
    endpoint,
    setSpeed,
    setEndpoint,
    tweak,
    selectAlgorithm,
    reshuffle,
    toggleNegativeCycle,
    pickNode,
    swapEndpoints,
    play,
    pause,
    step,
    reset,
    solve: preview,
    handleFinished,
  };
}
