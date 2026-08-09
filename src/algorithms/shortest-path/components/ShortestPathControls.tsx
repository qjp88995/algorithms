import {
  ArrowLeftRight,
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
import type { Endpoint, ShortestAlgorithm, ShortestConfig } from '../types';

export interface ShortestPathControlsProps {
  config: ShortestConfig;
  running: boolean;
  speed: number;
  endpoint: Endpoint;
  onPlay: () => void;
  onPause: () => void;
  onStep: () => void;
  onReset: () => void;
  onSolve: () => void;
  onSpeedChange: (value: number) => void;
  onAlgorithmChange: (value: ShortestAlgorithm) => void;
  /** 拖滑块类的改动：改完直接给结果 */
  onTweak: (patch: Partial<ShortestConfig>) => void;
  onReshuffle: () => void;
  onToggleCycle: () => void;
  onEndpointChange: (value: Endpoint) => void;
  onSwap: () => void;
}

const algorithmOptions: { value: ShortestAlgorithm; label: string }[] = [
  { value: 'dijkstra', label: 'Dijkstra' },
  { value: 'bellman-ford', label: 'Bellman-Ford' },
  { value: 'floyd-warshall', label: 'Floyd' },
];

export function ShortestPathControls({
  config,
  running,
  speed,
  endpoint,
  onPlay,
  onPause,
  onStep,
  onReset,
  onSolve,
  onSpeedChange,
  onAlgorithmChange,
  onTweak,
  onReshuffle,
  onToggleCycle,
  onEndpointChange,
  onSwap,
}: ShortestPathControlsProps) {
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
          max={80}
          unit=" 边/帧"
          hint="每帧检查多少条边"
          onChange={onSpeedChange}
        />
        <p className="text-xs leading-relaxed text-faint">
          单步一次只看一条边：白线是正在检查的边，青色表示这一下把距离改小了。
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
        <div className="grid grid-cols-2 gap-1.5">
          <ActionButton
            onClick={onReshuffle}
            className="text-xs"
            title="换一张图（G）"
          >
            <Shuffle />
            换一张图
          </ActionButton>
          <ActionButton onClick={onSwap} className="text-xs" title="交换起终点">
            <ArrowLeftRight />
            交换端点
          </ActionButton>
        </div>
      </ControlGroup>

      <ControlGroup title="边权">
        <SliderControl
          label="负权边比例"
          value={config.negativeRatio}
          min={0}
          max={1}
          step={0.1}
          hint="只翻一个方向，来回走一趟仍然是正的"
          onChange={value => onTweak({ negativeRatio: value })}
        />
        <p className="text-xs leading-relaxed text-faint">
          负权一出现就去看 Dijkstra 的答案：算错的节点会标红， 换成 Bellman-Ford
          立刻就对。
        </p>
        <ToggleControl
          label="注入一个负环"
          checked={config.negativeCycle}
          onChange={onToggleCycle}
        />
        <p className="text-xs leading-relaxed text-faint">
          环上绕一圈总代价为负，「最短路」这个说法本身就失效了 —— Bellman-Ford
          和 Floyd 会报出来，Dijkstra 只会若无其事地给个数。
        </p>
      </ControlGroup>

      <ControlGroup title="点击画布">
        <SegmentedControl<Endpoint>
          label="把点到的节点设为"
          value={endpoint}
          options={[
            { value: 'source', label: '起点' },
            { value: 'target', label: '终点' },
          ]}
          onChange={onEndpointChange}
        />
      </ControlGroup>
    </>
  );
}
