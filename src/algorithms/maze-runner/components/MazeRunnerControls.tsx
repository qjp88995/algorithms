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
  MAX_COLS,
  MIN_COLS,
} from '../constants';
import type { RunnerAlgorithm } from '../runner';

export interface MazeRunnerControlsProps {
  algorithm: RunnerAlgorithm;
  onAlgorithmChange: (value: RunnerAlgorithm) => void;
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
  fog: boolean;
  onFogChange: (value: boolean) => void;
}

export function MazeRunnerControls({
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
  fog,
  onFogChange,
}: MazeRunnerControlsProps) {
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
          <ActionButton onClick={onStep} title="走一步（S）">
            <StepForward />
            走一步
          </ActionButton>
          <ActionButton onClick={onSolve} title="一路走完（F）">
            <Zap />
            一路走完
          </ActionButton>
          <ActionButton onClick={onReset} title="回到起点（R）">
            <RotateCcw />
            回到起点
          </ActionButton>
        </div>
        <SliderControl
          label="速度"
          value={speed}
          min={1}
          max={60}
          unit=" 步/帧"
          hint="每帧走多少步"
          onChange={onSpeedChange}
        />
      </ControlGroup>

      <ControlGroup title="走法">
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
          {compare ? '对比模式下四种走法同时走同一张迷宫。' : current.blurb}
        </p>
        <ToggleControl
          label="四路对比"
          checked={compare}
          onChange={onCompareChange}
        />
      </ControlGroup>

      <ControlGroup title="视野">
        <ToggleControl label="迷雾" checked={fog} onChange={onFogChange} />
        <p className="text-xs leading-relaxed text-faint">
          开着迷雾才是第一人称：没走到的地方一无所知。 关掉就是上帝视角 ——
          那正是寻路那一页的前提。
        </p>
      </ControlGroup>

      <ControlGroup title="迷宫">
        <SliderControl
          label="尺寸"
          value={cols}
          min={MIN_COLS}
          max={MAX_COLS}
          step={2}
          unit={` × ${rows}`}
          hint="越大越能拉开四种走法的差距"
          onChange={onColsChange}
        />
        <ActionButton onClick={onReseed} title="换一张迷宫（G）">
          <Dices />
          换张迷宫 · {seed}
        </ActionButton>
        <p className="text-xs leading-relaxed text-faint">
          起点在左上，出口随机落在离它最远的那一档位置里 ——
          但走的人并不知道它在哪。
        </p>
      </ControlGroup>
    </>
  );
}
