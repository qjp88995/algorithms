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
} from '@/components/controls';
import { cn } from '@/lib/cn';

import { MAX_NODES, MIN_NODES, paretoColors } from '../constants';
import type { ParetoConfig, ParetoSolution } from '../types';

export interface ParetoPathControlsProps {
  config: ParetoConfig;
  running: boolean;
  speed: number;
  endpoint: 'source' | 'target';
  solutions: ParetoSolution[];
  selected: number;
  best: number;
  onPlay: () => void;
  onPause: () => void;
  onStep: () => void;
  onReset: () => void;
  onSolve: () => void;
  onSpeedChange: (value: number) => void;
  onLambdaChange: (value: number) => void;
  onTweak: (patch: Partial<ParetoConfig>) => void;
  onReshuffle: () => void;
  onSelect: (index: number) => void;
  onEndpointChange: (value: 'source' | 'target') => void;
  onSwap: () => void;
}

export function ParetoPathControls({
  config,
  running,
  speed,
  endpoint,
  solutions,
  selected,
  best,
  onPlay,
  onPause,
  onStep,
  onReset,
  onSolve,
  onSpeedChange,
  onLambdaChange,
  onTweak,
  onReshuffle,
  onSelect,
  onEndpointChange,
  onSwap,
}: ParetoPathControlsProps) {
  const unsupported = solutions.filter(item => !item.supported).length;

  return (
    <>
      <ControlGroup title="偏好">
        <SliderControl
          label="时间的权重 λ"
          value={config.lambda}
          min={0}
          max={1}
          step={0.02}
          hint="λ·时间 + (1-λ)·过路费 —— 把两个目标压成一个之后的答案"
          onChange={onLambdaChange}
        />
        <p className="text-xs leading-relaxed text-faint">
          从 0 拖到 1，选中的解只会在
          <span className="text-ink">角点</span>之间跳；
          {unsupported > 0
            ? `这张图上有 ${unsupported} 个解无论怎么调都拿不到。`
            : '这张图上恰好每个解都是角点。'}
        </p>
      </ControlGroup>

      <ControlGroup title={`帕累托前沿（${solutions.length}）`}>
        {solutions.length === 0 ? (
          <p className="text-xs text-faint">跑完才有结果。</p>
        ) : (
          <div className="flex flex-col gap-1">
            {solutions.map((solution, index) => (
              <button
                key={`${solution.time}-${solution.toll}`}
                type="button"
                onClick={() => onSelect(index)}
                className={cn(
                  'flex items-baseline gap-2 rounded-md px-2 py-1.5 text-left font-mono text-xs transition-colors duration-120',
                  index === selected
                    ? 'bg-raised text-ink'
                    : 'text-muted hover:bg-raised/60'
                )}
              >
                <span
                  className="size-2 shrink-0 rounded-full"
                  style={{
                    background: solution.supported
                      ? paretoColors.supported
                      : paretoColors.unsupported,
                  }}
                />
                <span className="tabular-nums">{solution.time} 分</span>
                <span className="tabular-nums text-faint">
                  ¥{solution.toll}
                </span>
                {index === best ? (
                  <span className="ml-auto text-xs text-faint">当前 λ</span>
                ) : !solution.supported ? (
                  <span className="ml-auto text-xs text-faint">凹处</span>
                ) : null}
              </button>
            ))}
          </div>
        )}
        <p className="text-xs leading-relaxed text-faint">
          点一条看它走哪儿（或按 [ / ]）。空心点、虚线的那几条就是加权和
          够不着的解。
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

      <ControlGroup title="路网">
        <SliderControl
          label="收费强度"
          value={config.spread}
          min={0}
          max={2}
          step={0.1}
          unit="×"
          hint="0 = 全网免费，第二个目标消失，前沿塌成一个点"
          onChange={value => onTweak({ spread: value })}
        />
        <SliderControl
          label="节点数"
          value={config.nodeCount}
          min={MIN_NODES}
          max={MAX_NODES}
          hint="节点越多，标签数涨得越凶"
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
