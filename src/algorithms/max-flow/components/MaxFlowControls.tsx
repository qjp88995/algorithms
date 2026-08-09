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
  SegmentedControl,
  SliderControl,
  ToggleControl,
} from '@/components/controls';

import { algorithmLabels, MAX_NODES, MIN_NODES } from '../constants';
import type { FlowAlgorithm, FlowConfig, FlowPreset } from '../types';

export interface MaxFlowControlsProps {
  config: FlowConfig;
  running: boolean;
  speed: number;
  onPlay: () => void;
  onPause: () => void;
  onStep: () => void;
  onReset: () => void;
  onSolve: () => void;
  onSpeedChange: (value: number) => void;
  onAlgorithmChange: (value: FlowAlgorithm) => void;
  onPresetChange: (value: FlowPreset) => void;
  /** 拖滑块类的改动：改完直接给结果 */
  onTweak: (patch: Partial<FlowConfig>) => void;
  onReshuffle: () => void;
  onToggleCut: () => void;
}

const algorithmOptions: { value: FlowAlgorithm; label: string }[] = [
  { value: 'ford-fulkerson', label: 'Ford-F.' },
  { value: 'edmonds-karp', label: 'Edmonds-K.' },
  { value: 'dinic', label: 'Dinic' },
];

export function MaxFlowControls({
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
  onPresetChange,
  onTweak,
  onReshuffle,
  onToggleCut,
}: MaxFlowControlsProps) {
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
          白色虚线是正在考察的边，青色是正在往下探的那条路。 一旦路上出现
          <span className="text-ink">紫色</span>
          ，那一段就是在把之前推的流退回去。
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
              title={`${algorithmLabels[option.value].label}（${index + 1}）`}
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

      <ControlGroup title="网络">
        <SegmentedControl<FlowPreset>
          label="用哪张网络"
          value={config.preset}
          options={[
            { value: 'diamond', label: '钻石图' },
            { value: 'random', label: '随机' },
          ]}
          onChange={onPresetChange}
        />
        <p className="text-xs leading-relaxed text-faint">
          钻石图中间那条容量 1 的边是专门放在那儿的：深度优先会一头扎进去，
          之后必须靠反向边把这 1 退回来；广度优先根本不碰它。
        </p>
        <SliderControl
          label="节点数"
          value={config.nodeCount}
          min={MIN_NODES}
          max={MAX_NODES}
          hint="改动会切到随机网络"
          onChange={value => onTweak({ nodeCount: value, preset: 'random' })}
        />
        <SliderControl
          label="平均度数"
          value={config.degree}
          min={2}
          max={5}
          onChange={value => onTweak({ degree: value, preset: 'random' })}
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

      <ControlGroup title="最小割">
        <ToggleControl
          label="跑完后画出割"
          checked={config.showCut}
          onChange={onToggleCut}
        />
        <p className="text-xs leading-relaxed text-faint">
          割不需要另外去找：流跑到最大之后，从源点在残量网络里还够得着的
          点就是割的一侧。红色那几条边的容量之和，一定正好等于最大流。
        </p>
      </ControlGroup>
    </>
  );
}
