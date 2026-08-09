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

import { MAX_COLS, MIN_COLS, turnColors } from '../constants';
import { DIR_ARROWS } from '../grid';
import type { Dir, RouteCost, TurnConfig, TurnStats } from '../types';

export interface TurnCostControlsProps {
  config: TurnConfig;
  stats: TurnStats | null;
  running: boolean;
  speed: number;
  showStates: boolean;
  onPlay: () => void;
  onPause: () => void;
  onStep: () => void;
  onReset: () => void;
  onSolve: () => void;
  onSpeedChange: (value: number) => void;
  onShowStatesChange: (value: boolean) => void;
  onCost: (patch: Partial<TurnConfig>) => void;
  onRebuild: (patch: Partial<TurnConfig>) => void;
  onReshuffle: () => void;
  onStartDirChange: (dir: Dir) => void;
}

export function TurnCostControls({
  config,
  stats,
  running,
  speed,
  showStates,
  onPlay,
  onPause,
  onStep,
  onReset,
  onSolve,
  onSpeedChange,
  onShowStatesChange,
  onCost,
  onRebuild,
  onReshuffle,
  onStartDirChange,
}: TurnCostControlsProps) {
  return (
    <>
      <ControlGroup title="账单">
        {stats?.done && stats.best ? (
          <div className="flex flex-col gap-1.5">
            <Bill
              color={turnColors.routeBest}
              label="状态空间最优"
              cost={stats.best}
              best={stats.best.cost}
            />
            <Bill
              color={turnColors.routeStepsFirst}
              label="步数优先"
              cost={stats.stepsFirst}
              best={stats.best.cost}
            />
            <Bill
              color={turnColors.routeNaive}
              label="朴素记账"
              cost={stats.naive}
              best={stats.best.cost}
            />
          </div>
        ) : (
          <p className="text-xs text-faint">跑完才有账单。</p>
        )}
        <p className="text-xs leading-relaxed text-faint">
          代价 = 步数 + 转弯罚金。三条路线都能走通，差别全在这笔账上。
        </p>
      </ControlGroup>

      <ControlGroup title="转弯有多贵">
        <SliderControl
          label="转 90°"
          value={config.turnCost}
          min={0}
          max={8}
          step={0.5}
          unit=" 步"
          hint="拉到 0：转弯免费，三条路线会重合"
          onChange={value => onCost({ turnCost: value })}
        />
        <SliderControl
          label="掉头 180°"
          value={config.uTurnCost}
          min={0}
          max={16}
          step={0.5}
          unit=" 步"
          onChange={value => onCost({ uTurnCost: value })}
        />
        <SegmentedControl<string>
          label="出发时车头朝向"
          value={String(config.startDir)}
          options={DIR_ARROWS.map((arrow, index) => ({
            value: String(index),
            label: arrow,
          }))}
          onChange={value => onStartDirChange(Number(value) as Dir)}
        />
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
          max={120}
          unit=" 边/帧"
          hint="每帧检查多少条出边"
          onChange={onSpeedChange}
        />
        <ToggleControl
          label="显示状态空间"
          checked={showStates}
          onChange={onShowStatesChange}
        />
        <p className="text-xs leading-relaxed text-faint">
          每个格子切成四个三角，一个三角是一个状态。关掉它就退回普通网格视图 ——
          也就是这一页之前你在寻路页看到的那种。
        </p>
      </ControlGroup>

      <ControlGroup title="地图">
        <SliderControl
          label="障碍密度"
          value={config.density}
          min={0}
          max={0.34}
          step={0.02}
          hint="空场地上最优就是一条 L；障碍多了才有得绕"
          onChange={value => onRebuild({ density: value })}
        />
        <SliderControl
          label="网格宽度"
          value={config.cols}
          min={MIN_COLS}
          max={MAX_COLS}
          unit=" 格"
          onChange={value =>
            onRebuild({ cols: value, rows: Math.round(value * 0.66) })
          }
        />
        <ActionButton
          onClick={onReshuffle}
          className="text-xs"
          title="换一张地图（G）"
        >
          <Shuffle />
          换一张地图
        </ActionButton>
      </ControlGroup>
    </>
  );
}

function Bill({
  color,
  label,
  cost,
  best,
}: {
  color: string;
  label: string;
  cost: RouteCost | null;
  best: number;
}) {
  const extra = cost ? cost.cost - best : 0;
  return (
    <div className="flex items-baseline gap-2 text-xs">
      <span
        className="size-2 shrink-0 rounded-full"
        style={{ background: color }}
      />
      <span className="text-muted">{label}</span>
      <span className="ml-auto font-mono tabular-nums">
        {cost ? (
          <>
            <span className="text-faint">
              {cost.steps} 步 {cost.turns + cost.uTurns} 弯{' '}
            </span>
            <span className="text-ink">{round(cost.cost)}</span>
            {extra > 0 ? (
              <span className="text-danger"> +{round(extra)}</span>
            ) : null}
          </>
        ) : (
          '—'
        )}
      </span>
    </div>
  );
}

function round(value: number) {
  return Math.round(value * 10) / 10;
}
