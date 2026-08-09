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

import { DAY, MAX_NODES, MIN_NODES, ROADWORK_OPEN_AT } from '../constants';
import { formatClock } from '../network';
import type { FastestConfig } from '../types';

export interface FastestPathControlsProps {
  config: FastestConfig;
  running: boolean;
  speed: number;
  endpoint: 'source' | 'target';
  onPlay: () => void;
  onPause: () => void;
  onStep: () => void;
  onReset: () => void;
  onSolve: () => void;
  onSpeedChange: (value: number) => void;
  onDepartureChange: (value: number) => void;
  onTweak: (patch: Partial<FastestConfig>) => void;
  onReshuffle: () => void;
  onToggleRoadwork: () => void;
  onToggleWaiting: () => void;
  onEndpointChange: (value: 'source' | 'target') => void;
  onSwap: () => void;
}

export function FastestPathControls({
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
  onDepartureChange,
  onTweak,
  onReshuffle,
  onToggleRoadwork,
  onToggleWaiting,
  onEndpointChange,
  onSwap,
}: FastestPathControlsProps) {
  return (
    <>
      <ControlGroup title="出发时刻">
        <SliderControl
          label="出发时刻"
          value={config.departure}
          min={0}
          max={DAY - 5}
          step={5}
          format={formatClock}
          hint="拖动它（或按 , / .），看最优路线在一天之内怎么换"
          onChange={onDepartureChange}
        />
        <SliderControl
          label="高峰强度"
          value={config.rush}
          min={0}
          max={3}
          step={0.1}
          unit="×"
          hint="0 = 全天畅通，路网退化成静态图"
          onChange={value => onTweak({ rush: value })}
        />
        <p className="text-xs leading-relaxed text-faint">
          路的颜色就是它此刻的拥堵程度，绿到红。两辆车同时发车：金色走时间依赖
          最优路线，蓝色走「只看自由流时间」选的静态路线。
        </p>
      </ControlGroup>

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
          max={60}
          unit=" 边/帧"
          hint="每帧检查多少条边"
          onChange={onSpeedChange}
        />
      </ControlGroup>

      <ControlGroup title="FIFO 假设">
        <ToggleControl
          label={`施工封路（${formatClock(ROADWORK_OPEN_AT)} 放行）`}
          checked={config.roadwork}
          onChange={onToggleRoadwork}
        />
        <p className="text-xs leading-relaxed text-faint">
          主干道上封一段：放行前通过要多付 90 分钟。于是「早一分钟出发反而晚到」
          成立，FIFO 被打破 —— Dijkstra「最早到达即定稿」的底气也就没了。
          把出发时刻拖到到达曲线上的红色段落里，看统计栏。
        </p>
        <ToggleControl
          label="允许在节点等待"
          checked={config.waiting}
          onChange={onToggleWaiting}
        />
        <p className="text-xs leading-relaxed text-faint">
          允许干等之后，「早到」重新变得永远不吃亏（大不了在路口等到放行），
          FIFO 恢复，Dijkstra 又对了。
        </p>
      </ControlGroup>

      <ControlGroup title="路网">
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
          hint="路口平均连出几条路"
          onChange={value => onTweak({ degree: value })}
        />
        <div className="grid grid-cols-2 gap-1.5">
          <ActionButton
            onClick={onReshuffle}
            className="text-xs"
            title="换一张路网（G）"
          >
            <Shuffle />
            换一张图
          </ActionButton>
          <ActionButton onClick={onSwap} className="text-xs" title="交换起终点">
            <ArrowLeftRight />
            交换端点
          </ActionButton>
        </div>
        <SegmentedControl<'source' | 'target'>
          label="点击画布上的路口，设为"
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
