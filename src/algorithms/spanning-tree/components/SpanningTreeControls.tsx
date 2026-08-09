import {
  Pause,
  Play,
  RotateCcw,
  Shuffle,
  StepForward,
  Zap,
} from 'lucide-react';

import {
  ActionButton,
  ControlGroup,
  SliderControl,
  ToggleControl,
} from '@/components/controls';

import { algorithmLabels, MAX_NODES, MIN_NODES } from '../constants';
import type { SpanningAlgorithm, SpanningConfig } from '../types';

export interface SpanningTreeControlsProps {
  config: SpanningConfig;
  running: boolean;
  speed: number;
  onPlay: () => void;
  onPause: () => void;
  onStep: () => void;
  onReset: () => void;
  onSolve: () => void;
  onSpeedChange: (value: number) => void;
  onAlgorithmChange: (value: SpanningAlgorithm) => void;
  /** 拖滑块类的改动：改完直接给结果 */
  onTweak: (patch: Partial<SpanningConfig>) => void;
  onReshuffle: () => void;
  onToggleCompare: () => void;
}

const algorithmOptions: { value: SpanningAlgorithm; label: string }[] = [
  { value: 'kruskal', label: 'Kruskal' },
  { value: 'prim', label: 'Prim' },
  { value: 'boruvka', label: 'Borůvka' },
];

export function SpanningTreeControls({
  config,
  running,
  speed,
  onPlay,
  onPause,
  onStep,
  onReset,
  onSolve,
  onSpeedChange,
  onAlgorithmChange,
  onTweak,
  onReshuffle,
  onToggleCompare,
}: SpanningTreeControlsProps) {
  const current = algorithmLabels[config.algorithm];

  return (
    <>
      <ControlGroup title="播放">
        <div className="grid grid-cols-2 gap-1.5">
          <ActionButton
            variant="primary"
            onClick={running ? onPause : onPlay}
            title={running ? '暂停（Space）' : '播放（Space）'}
          >
            {running ? <Pause /> : <Play />}
            {running ? '暂停' : '播放'}
          </ActionButton>
          <ActionButton onClick={onStep} title="单步（S）">
            <StepForward />
            单步
          </ActionButton>
          <ActionButton onClick={onSolve} title="直接求解（F）">
            <Zap />
            直接求解
          </ActionButton>
          <ActionButton onClick={onReset} title="重置（R）">
            <RotateCcw />
            重置
          </ActionButton>
        </div>
        <SliderControl
          label="速度"
          value={speed}
          min={1}
          max={40}
          unit=" 边/帧"
          hint="每帧考察多少条边"
          onChange={onSpeedChange}
        />
        <p className="text-xs leading-relaxed text-faint">
          单步一次只看一条边：白线是正在考察的边，收下就变金色并入树，
          红线表示两端已经连通、收了会成环。
        </p>
      </ControlGroup>

      <ControlGroup title="算法">
        <div className="grid grid-cols-3 gap-1.5">
          {algorithmOptions.map((option, index) => (
            <ActionButton
              key={option.value}
              variant={option.value === config.algorithm ? 'primary' : 'ghost'}
              onClick={() => onAlgorithmChange(option.value)}
              className="text-xs"
              title={`${option.label}（${index + 1}）`}
            >
              {option.label}
            </ActionButton>
          ))}
        </div>
        <p className="text-xs leading-relaxed text-faint">
          <span className="font-mono text-muted">{current.complexity}</span> ——{' '}
          {current.blurb}
        </p>
      </ControlGroup>

      <ControlGroup title="图">
        <SliderControl
          label="节点数"
          value={config.nodeCount}
          min={MIN_NODES}
          max={MAX_NODES}
          onChange={value => onTweak({ nodeCount: value })}
        />
        <SliderControl
          label="平均度数"
          value={config.degree}
          min={2}
          max={5}
          hint="每个节点平均连出几条边"
          onChange={value => onTweak({ degree: value })}
        />
        <ActionButton
          onClick={onReshuffle}
          className="text-xs"
          title="换一张图（G）"
        >
          <Shuffle />
          换一张图
        </ActionButton>
      </ControlGroup>

      <ControlGroup title="对照">
        <ToggleControl
          label="叠加最短路树"
          checked={config.compare}
          onChange={onToggleCompare}
        />
        <p className="text-xs leading-relaxed text-faint">
          蓝色虚线是从根出发的最短路树。它和生成树的边集根本不重合 ——
          一个让整棵树最省，一个让根到每个点最近，这是两件事。
        </p>
        <p className="text-xs leading-relaxed text-faint">
          打开后每个点下面会写「沿生成树走 / 真正的最短」。红色的那些就是
          被生成树坑了的点，圈着红环的是绕得最离谱的一个。
        </p>
      </ControlGroup>

      <ControlGroup title="点击画布">
        <p className="text-xs leading-relaxed text-faint">
          点任意节点把它设为根。Kruskal 和 Borůvka 的结果与根无关 —— 换根只影响
          Prim 从哪儿开始滚，以及对照那棵最短路树。
        </p>
      </ControlGroup>
    </>
  );
}
