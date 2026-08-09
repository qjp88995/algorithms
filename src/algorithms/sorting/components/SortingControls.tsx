import { Dices, Pause, Play, RotateCcw, StepForward, Zap } from 'lucide-react';

import {
  ActionButton,
  ControlGroup,
  SliderControl,
  ToggleControl,
} from '@/components/controls';

import {
  algorithmLabels,
  comparedAlgorithms,
  distributionLabels,
  MAX_SIZE,
  MAX_SPEED,
  MIN_SIZE,
} from '../constants';
import type { Distribution } from '../data';
import type { SortAlgorithm } from '../sorter';

export interface SortingControlsProps {
  algorithm: SortAlgorithm;
  onAlgorithmChange: (value: SortAlgorithm) => void;
  running: boolean;
  onPlay: () => void;
  onPause: () => void;
  onStep: () => void;
  onReset: () => void;
  onSolve: () => void;
  speed: number;
  onSpeedChange: (value: number) => void;
  size: number;
  onSizeChange: (value: number) => void;
  distribution: Distribution;
  onDistributionChange: (value: Distribution) => void;
  seed: number;
  onReseed: () => void;
  compare: boolean;
  onCompareChange: (value: boolean) => void;
}

const distributions = Object.keys(distributionLabels) as Distribution[];

export function SortingControls({
  algorithm,
  onAlgorithmChange,
  running,
  onPlay,
  onPause,
  onStep,
  onReset,
  onSolve,
  speed,
  onSpeedChange,
  size,
  onSizeChange,
  distribution,
  onDistributionChange,
  seed,
  onReseed,
  compare,
  onCompareChange,
}: SortingControlsProps) {
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
          <ActionButton onClick={onSolve} title="直接排完（F）">
            <Zap />
            直接排完
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
          max={MAX_SPEED}
          unit=" 步/帧"
          hint="一次比较或一次搬动算一步"
          onChange={onSpeedChange}
        />
        <p className="text-xs leading-relaxed text-faint">
          单步一次执行一步：青色是这一步碰到的位置，橙色是被盯住的那个 ——
          快排的轴、选择排序当前的最小值。
        </p>
      </ControlGroup>

      <ControlGroup title="算法">
        <div className="grid grid-cols-2 gap-1.5">
          {comparedAlgorithms.map((value, index) => (
            <ActionButton
              key={value}
              variant={value === algorithm && !compare ? 'primary' : 'ghost'}
              onClick={() => onAlgorithmChange(value)}
              className="text-xs"
              disabled={compare}
              title={`${algorithmLabels[value].label}（${index + 1}）`}
            >
              {algorithmLabels[value].short}
            </ActionButton>
          ))}
        </div>
        <p className="text-xs leading-relaxed text-faint">
          {compare
            ? '对比模式下六种算法同时排。'
            : algorithmLabels[algorithm].blurb}
        </p>
        <ToggleControl
          label="六路对比"
          checked={compare}
          onChange={onCompareChange}
        />
      </ControlGroup>

      <ControlGroup title="数据">
        <div className="grid grid-cols-2 gap-1.5">
          {distributions.map(value => (
            <ActionButton
              key={value}
              variant={value === distribution ? 'primary' : 'ghost'}
              onClick={() => onDistributionChange(value)}
              className="text-xs"
              title={`${distributionLabels[value].label}（D 循环切换）`}
            >
              {distributionLabels[value].label}
            </ActionButton>
          ))}
        </div>
        <p className="text-xs leading-relaxed text-faint">
          {distributionLabels[distribution].blurb}
        </p>
        <SliderControl
          label="元素个数"
          value={size}
          min={MIN_SIZE}
          max={MAX_SIZE}
          step={4}
          unit=" 个"
          hint="调小到几十个，单步时每根柱子都还看得清"
          onChange={onSizeChange}
        />
        <ActionButton onClick={onReseed} title="换一批数据（G）">
          <Dices />
          换批数据 · {seed}
        </ActionButton>
        <p className="text-xs leading-relaxed text-faint">
          换数据后停在起手状态，按播放才开始 ——
          先看清这批数据长什么样，再看算法怎么对付它。
        </p>
      </ControlGroup>
    </>
  );
}
