import { useCallback, useMemo, useState } from 'react';

import { DEFAULT_SPEED, defaultConfig } from './constants';
import { compareTrees } from './reference';
import { buildScene, type SpanningScene } from './scene';
import type { SpanningAlgorithm, SpanningConfig } from './types';

interface SceneState {
  config: SpanningConfig;
  scene: SpanningScene;
  root: number;
}

function createSceneState(config: SpanningConfig): SceneState {
  const scene = buildScene(config);
  return { config, scene, root: scene.root };
}

/**
 * 最小生成树演示的状态中枢。
 *
 * 图是**不可变**的：一局的节点坐标和边权在 `buildScene` 里一次性算完，
 * 之后只读。所以它就是普通的 state，不需要 ref —— 每帧都在变的只有
 * 内核自己的并查集和已选边，那部分归画布管。
 *
 * 对照（最短路树）是这张图加这个根的**确定性质**，跟播放进度无关，
 * 所以在这里一次算好传下去，而不是塞进内核。切换对照也就不必重播 ——
 * 边看边叠上去，正是想让人做的事。
 */
export function useSpanningTree() {
  const [state, setState] = useState(() => createSceneState(defaultConfig));
  const [runId, setRunId] = useState(0);
  // 进页面直接播：这一页要看的就是三个算法收边顺序的差异
  const [running, setRunning] = useState(true);
  const [instant, setInstant] = useState(false);
  const [speed, setSpeed] = useState(DEFAULT_SPEED);
  const [stepId, setStepId] = useState(0);

  const comparison = useMemo(
    () =>
      state.config.compare
        ? compareTrees(
            state.scene.graph,
            state.scene.weights,
            state.scene.reference.links,
            state.root
          )
        : null,
    [state.config.compare, state.scene, state.root]
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

  /** 改图的参数一律重建场景；节点数没变就留住用户挑的根 */
  const patchConfig = useCallback((patch: Partial<SpanningConfig>) => {
    setState(prev => {
      const config = { ...prev.config, ...patch };
      const scene = buildScene(config);
      const keep = config.nodeCount === prev.config.nodeCount;
      return { config, scene, root: keep ? prev.root : scene.root };
    });
  }, []);

  const tweak = useCallback(
    (patch: Partial<SpanningConfig>) => {
      patchConfig(patch);
      preview();
    },
    [patchConfig, preview]
  );

  const selectAlgorithm = useCallback(
    (algorithm: SpanningAlgorithm) => {
      setState(prev => ({ ...prev, config: { ...prev.config, algorithm } }));
      replay();
    },
    [replay]
  );

  const reshuffle = useCallback(() => {
    patchConfig({ seed: Math.floor(Math.random() * 100000) });
    replay();
  }, [patchConfig, replay]);

  /** 对照只是叠一层显示，不影响算法在算什么 —— 所以不重播 */
  const toggleCompare = useCallback(() => {
    setState(prev => ({
      ...prev,
      config: { ...prev.config, compare: !prev.config.compare },
    }));
  }, []);

  const pickRoot = useCallback(
    (node: number) => {
      setState(prev => (node === prev.root ? prev : { ...prev, root: node }));
      preview();
    },
    [preview]
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
    setRunId(id => id + 1);
  }, []);

  const handleFinished = useCallback(() => setRunning(false), []);

  return {
    config: state.config,
    scene: state.scene,
    root: state.root,
    comparison,
    runId,
    running,
    instant,
    speed,
    stepId,
    setSpeed,
    tweak,
    selectAlgorithm,
    reshuffle,
    toggleCompare,
    pickRoot,
    play,
    pause,
    step,
    reset,
    solve: preview,
    handleFinished,
  };
}
