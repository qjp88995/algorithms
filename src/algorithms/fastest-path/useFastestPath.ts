import { useCallback, useMemo, useState } from 'react';

import { DEFAULT_SPEED, defaultConfig } from './constants';
import { arrivalProfile, buildNetwork, type RoadNetwork } from './network';
import type { FastestConfig } from './types';

interface NetworkState {
  config: FastestConfig;
  network: RoadNetwork;
  source: number;
  target: number;
}

function createNetworkState(config: FastestConfig): NetworkState {
  const network = buildNetwork(config);
  return { config, network, source: network.source, target: network.target };
}

/**
 * 最快路径演示的状态中枢。
 *
 * 路网是不可变的，参数一改就整个重建 —— 但**出发时刻不参与重建**：
 * 它不改变路网，只改变"从几点开始算"。分开之后，拖出发时刻滑块时
 * 只重跑搜索，那条要跑 144 次搜索才画得出来的到达曲线不用重算。
 */
export function useFastestPath() {
  const [state, setState] = useState(() => createNetworkState(defaultConfig));
  const [runId, setRunId] = useState(0);
  const [running, setRunning] = useState(true);
  const [instant, setInstant] = useState(false);
  const [speed, setSpeed] = useState(DEFAULT_SPEED);
  const [stepId, setStepId] = useState(0);
  const [endpoint, setEndpoint] = useState<'source' | 'target'>('target');

  const profile = useMemo(
    () => arrivalProfile(state.network, state.source, state.target),
    [state.network, state.source, state.target]
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

  /** 改路网的参数：重建后端点尽量留住 */
  const rebuild = useCallback((patch: Partial<FastestConfig>) => {
    setState(prev => {
      const config = { ...prev.config, ...patch };
      const network = buildNetwork(config);
      const keep = config.nodeCount === prev.config.nodeCount;
      return {
        config,
        network,
        source: keep ? prev.source : network.source,
        target: keep ? prev.target : network.target,
      };
    });
  }, []);

  const tweak = useCallback(
    (patch: Partial<FastestConfig>) => {
      rebuild(patch);
      preview();
    },
    [preview, rebuild]
  );

  /** 出发时刻不动路网，只换搜索的起算时间 */
  const setDeparture = useCallback(
    (departure: number) => {
      setState(prev => ({ ...prev, config: { ...prev.config, departure } }));
      preview();
    },
    [preview]
  );

  const reshuffle = useCallback(() => {
    rebuild({ seed: Math.floor(Math.random() * 100000) });
    replay();
  }, [rebuild, replay]);

  const toggleRoadwork = useCallback(() => {
    setState(prev => {
      const config = { ...prev.config, roadwork: !prev.config.roadwork };
      return { ...prev, config, network: buildNetwork(config) };
    });
    replay();
  }, [replay]);

  const toggleWaiting = useCallback(() => {
    setState(prev => {
      const config = { ...prev.config, waiting: !prev.config.waiting };
      return { ...prev, config, network: buildNetwork(config) };
    });
    replay();
  }, [replay]);

  const pickNode = useCallback(
    (node: number) => {
      setState(prev => {
        if (node === prev.source || node === prev.target) return prev;
        return endpoint === 'source'
          ? { ...prev, source: node }
          : { ...prev, target: node };
      });
      preview();
    },
    [endpoint, preview]
  );

  const swapEndpoints = useCallback(() => {
    setState(prev => ({ ...prev, source: prev.target, target: prev.source }));
    preview();
  }, [preview]);

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
    network: state.network,
    source: state.source,
    target: state.target,
    profile,
    runId,
    running,
    instant,
    speed,
    stepId,
    endpoint,
    setSpeed,
    setEndpoint,
    setDeparture,
    tweak,
    reshuffle,
    toggleRoadwork,
    toggleWaiting,
    pickNode,
    swapEndpoints,
    play: replay,
    pause,
    step,
    reset,
    solve: preview,
    handleFinished,
  };
}
