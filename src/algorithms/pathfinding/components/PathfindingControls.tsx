import {
  Eraser,
  Grid3x3,
  Pause,
  Play,
  RotateCcw,
  Shuffle,
  Trees,
  Zap,
} from 'lucide-react';

import {
  ActionButton,
  ControlGroup,
  SegmentedControl,
  SliderControl,
  ToggleControl,
} from '@/components/controls';

import { algorithmLabels, heuristicLabels } from '../constants';
import type { Brush, Heuristic, SearchAlgorithm, SearchConfig } from '../types';

export interface PathfindingControlsProps {
  config: SearchConfig;
  onConfigChange: (patch: Partial<SearchConfig>) => void;
  /** 换算法会重新播一遍动画，和调滑块的即时求解区分开 */
  onAlgorithmChange: (algorithm: SearchAlgorithm) => void;
  running: boolean;
  onPlay: () => void;
  onPause: () => void;
  onReset: () => void;
  onSolve: () => void;
  speed: number;
  onSpeedChange: (value: number) => void;
  brush: Brush;
  onBrushChange: (value: Brush) => void;
  compare: boolean;
  onCompareChange: (value: boolean) => void;
  onBuildMaze: () => void;
  onBuildRandom: () => void;
  onClear: () => void;
}

const algorithmOptions: { value: SearchAlgorithm; label: string }[] = [
  { value: 'astar', label: 'A*' },
  { value: 'dijkstra', label: 'Dijkstra' },
  { value: 'bfs', label: 'BFS' },
  { value: 'greedy', label: '贪心' },
];

const heuristicOptions = (Object.keys(heuristicLabels) as Heuristic[]).map(
  value => ({ value, label: heuristicLabels[value] })
);

export function PathfindingControls({
  config,
  onConfigChange,
  onAlgorithmChange,
  running,
  onPlay,
  onPause,
  onReset,
  onSolve,
  speed,
  onSpeedChange,
  brush,
  onBrushChange,
  compare,
  onCompareChange,
  onBuildMaze,
  onBuildRandom,
  onClear,
}: PathfindingControlsProps) {
  const current = algorithmLabels[config.algorithm];
  const heuristicDisabled =
    config.algorithm === 'dijkstra' || config.algorithm === 'bfs';

  return (
    <>
      <ControlGroup title="播放">
        <div className="grid grid-cols-2 gap-1.5">
          <ActionButton variant="primary" onClick={running ? onPause : onPlay}>
            {running ? <Pause /> : <Play />}
            {running ? '暂停' : '播放'}
          </ActionButton>
          <ActionButton onClick={onSolve}>
            <Zap />
            直接求解
          </ActionButton>
          <ActionButton onClick={onReset}>
            <RotateCcw />
            重置搜索
          </ActionButton>
        </div>
        <SliderControl
          label="速度"
          value={speed}
          min={1}
          max={60}
          unit=" 格/帧"
          hint="每帧展开多少个节点"
          onChange={onSpeedChange}
        />
      </ControlGroup>

      <ControlGroup title="算法">
        <div className="grid grid-cols-2 gap-1.5">
          {algorithmOptions.map(option => (
            <ActionButton
              key={option.value}
              variant={
                option.value === config.algorithm && !compare
                  ? 'primary'
                  : 'ghost'
              }
              onClick={() => onAlgorithmChange(option.value)}
              className="text-xs"
              disabled={compare}
            >
              {option.label}
            </ActionButton>
          ))}
        </div>
        <p className="text-xs leading-relaxed text-faint">
          {compare ? '对比模式下四个算法同时运行。' : current.blurb}
        </p>
        <ToggleControl
          label="四路对比"
          checked={compare}
          onChange={onCompareChange}
        />
      </ControlGroup>

      <ControlGroup title="启发式">
        <SegmentedControl<Heuristic>
          value={config.heuristic}
          options={heuristicOptions.slice(0, 2)}
          onChange={value => onConfigChange({ heuristic: value })}
        />
        <SegmentedControl<Heuristic>
          value={config.heuristic}
          options={heuristicOptions.slice(2)}
          onChange={value => onConfigChange({ heuristic: value })}
        />
        {heuristicDisabled ? (
          <p className="text-xs leading-relaxed text-faint">
            Dijkstra 和 BFS 不使用启发式，改这里只影响 A* 与贪心。
          </p>
        ) : null}
        <SliderControl
          label="启发式权重"
          value={config.heuristicWeight}
          min={1}
          max={5}
          step={0.5}
          unit="×"
          hint=">1 是加权 A*：更快，但可能不是最短路"
          onChange={value => onConfigChange({ heuristicWeight: value })}
        />
        <ToggleControl
          label="允许对角移动"
          checked={config.allowDiagonal}
          onChange={value =>
            onConfigChange({
              allowDiagonal: value,
              // 四向配曼哈顿、八向配八方距离，否则启发式会高估
              heuristic: value ? 'octile' : 'manhattan',
            })
          }
        />
      </ControlGroup>

      <ControlGroup title="画笔">
        <SegmentedControl<Brush>
          value={brush}
          options={[
            { value: 'wall', label: '墙' },
            { value: 'swamp', label: '沼泽' },
            { value: 'erase', label: '橡皮' },
          ]}
          onChange={onBrushChange}
        />
        <p className="text-xs leading-relaxed text-faint">
          在画布上拖动即可绘制，拖动两端的圆点可以移动起点和终点。
        </p>
      </ControlGroup>

      <ControlGroup title="地形">
        <div className="grid grid-cols-2 gap-1.5">
          <ActionButton onClick={onBuildMaze} className="text-xs">
            <Grid3x3 />
            迷宫
          </ActionButton>
          <ActionButton onClick={onBuildRandom} className="text-xs">
            <Shuffle />
            随机
          </ActionButton>
          <ActionButton onClick={onClear} className="text-xs">
            <Eraser />
            清空
          </ActionButton>
          <ActionButton
            onClick={() => onBrushChange('swamp')}
            className="text-xs"
          >
            <Trees />
            画沼泽
          </ActionButton>
        </div>
      </ControlGroup>
    </>
  );
}
