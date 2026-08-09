import { useCallback, useState } from 'react';

import { DEFAULT_SPEED, defaultConfig } from './constants';
import { buildNetwork, type TollNetwork } from './network';
import { pickByLambda } from './pareto';
import type { CostPoint, ParetoConfig, ParetoSolution } from './types';

interface NetworkState {
  config: ParetoConfig;
  network: TollNetwork;
  source: number;
  target: number;
}

/** 搜索跑完之后画布交回来的东西 */
export interface ParetoResult {
  solutions: ParetoSolution[];
  samples: CostPoint[];
}

function createNetworkState(config: ParetoConfig): NetworkState {
  const network = buildNetwork(config);
  return { config, network, source: network.source, target: network.target };
}

/**
 * 帕累托权衡演示的状态中枢。
 *
 * 和另外两个图论页不同的地方在于**偏好 λ 不参与搜索**：前沿一次算完，
 * 之后调权重只是在这组解里挑一个而已。这不是实现上的取巧，正是这一页
 * 要说的事 —— 先把所有值得考虑的答案摆出来，再谈偏好；反过来做
 * （先定权重再搜索），有些答案你根本没机会看见。
 */
export function useParetoPath() {
  const [state, setState] = useState(() => createNetworkState(defaultConfig));
  const [runId, setRunId] = useState(0);
  const [running, setRunning] = useState(true);
  const [instant, setInstant] = useState(false);
  const [speed, setSpeed] = useState(DEFAULT_SPEED);
  const [stepId, setStepId] = useState(0);
  const [endpoint, setEndpoint] = useState<'source' | 'target'>('target');
  const [result, setResult] = useState<ParetoResult | null>(null);
  /** 用户手动钉住的解；null 表示跟着偏好走 */
  const [pinned, setPinned] = useState<number | null>(null);

  const restart = useCallback(() => {
    setResult(null);
    setPinned(null);
    setRunId(id => id + 1);
  }, []);

  const replay = useCallback(() => {
    setInstant(false);
    setRunning(true);
    restart();
  }, [restart]);

  const preview = useCallback(() => {
    setRunning(false);
    setInstant(true);
    restart();
  }, [restart]);

  /** 改路网的参数：重建后端点尽量留住 */
  const rebuild = useCallback((patch: Partial<ParetoConfig>) => {
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
    (patch: Partial<ParetoConfig>) => {
      rebuild(patch);
      preview();
    },
    [preview, rebuild]
  );

  /** 偏好不碰路网、也不重跑搜索 —— 它只决定在已有的解里挑谁 */
  const setLambda = useCallback((lambda: number) => {
    setState(prev => ({ ...prev, config: { ...prev.config, lambda } }));
    setPinned(null);
  }, []);

  const reshuffle = useCallback(() => {
    rebuild({ seed: Math.floor(Math.random() * 100000) });
    replay();
  }, [rebuild, replay]);

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
    restart();
  }, [restart]);

  const handleFinished = useCallback(() => setRunning(false), []);
  const handleSolved = useCallback((solved: ParetoResult) => {
    setResult(solved);
  }, []);

  const solutions = result?.solutions ?? [];
  /** 当前偏好会选中谁 —— 等权重线画在它身上 */
  const best =
    solutions.length > 0 ? pickByLambda(solutions, state.config.lambda) : -1;
  const selected = pinned !== null && pinned < solutions.length ? pinned : best;

  /** 在前沿里换一个解，越界就绕回来 */
  const browse = useCallback(
    (delta: number) => {
      setPinned(prev => {
        const count = solutions.length;
        if (count === 0) return prev;
        const from = prev ?? best;
        return (from + delta + count) % count;
      });
    },
    [best, solutions.length]
  );

  return {
    config: state.config,
    network: state.network,
    source: state.source,
    target: state.target,
    solutions,
    samples: result?.samples ?? [],
    selected,
    best,
    runId,
    running,
    instant,
    speed,
    stepId,
    endpoint,
    setSpeed,
    setEndpoint,
    setLambda,
    tweak,
    reshuffle,
    pickNode,
    swapEndpoints,
    select: setPinned,
    browse,
    play: replay,
    pause,
    step,
    reset,
    solve: preview,
    handleFinished,
    handleSolved,
  };
}
