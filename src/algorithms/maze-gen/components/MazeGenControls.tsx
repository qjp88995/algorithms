import { Dices, Pause, Play, RotateCcw, StepForward, Zap } from 'lucide-react';

import {
  ActionButton,
  ControlGroup,
  SliderControl,
  ToggleControl,
} from '@/components/controls';
import type { MazeAlgorithm } from '@/lib/maze/generators';

import {
  algorithmLabels,
  comparedAlgorithms,
  MAX_COLS,
  MIN_COLS,
} from '../constants';

export interface MazeGenControlsProps {
  algorithm: MazeAlgorithm;
  onAlgorithmChange: (value: MazeAlgorithm) => void;
  running: boolean;
  onPlay: () => void;
  onPause: () => void;
  onStep: () => void;
  onReset: () => void;
  onSolve: () => void;
  speed: number;
  onSpeedChange: (value: number) => void;
  cols: number;
  rows: number;
  onColsChange: (value: number) => void;
  seed: number;
  onReseed: () => void;
  compare: boolean;
  onCompareChange: (value: boolean) => void;
}

export function MazeGenControls({
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
  cols,
  rows,
  onColsChange,
  seed,
  onReseed,
  compare,
  onCompareChange,
}: MazeGenControlsProps) {
  const current = algorithmLabels[algorithm];

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
          <ActionButton onClick={onSolve} title="直接生成（F）">
            <Zap />
            直接生成
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
          unit=" 步/帧"
          hint="每帧执行多少步"
          onChange={onSpeedChange}
        />
        <p className="text-xs leading-relaxed text-faint">
          单步一次执行一步：白框就是算法此刻在动的那一格。
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
              {algorithmLabels[value].label}
            </ActionButton>
          ))}
        </div>
        <p className="text-xs leading-relaxed text-faint">
          {compare ? '对比模式下四种算法同时生成。' : current.blurb}
        </p>
        <ToggleControl
          label="四路对比"
          checked={compare}
          onChange={onCompareChange}
        />
      </ControlGroup>

      <ControlGroup title="迷宫">
        <SliderControl
          label="尺寸"
          value={cols}
          min={MIN_COLS}
          max={MAX_COLS}
          step={2}
          unit={` × ${rows}`}
          hint="列数取奇数，通道格才落得整齐"
          onChange={onColsChange}
        />
        <ActionButton onClick={onReseed} title="换一个种子（G）">
          <Dices />
          换个种子 · {seed}
        </ActionButton>
        <p className="text-xs leading-relaxed text-faint">
          同一个种子长出同一张迷宫。对比模式下四块画布共用它，比的才是长法。
        </p>
      </ControlGroup>
    </>
  );
}
