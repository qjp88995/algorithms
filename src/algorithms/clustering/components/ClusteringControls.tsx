import {
  Dices,
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

import {
  algorithmLabels,
  datasetLabels,
  MAX_EPS,
  MAX_K,
  MAX_POINTS,
  MIN_EPS,
  MIN_K,
  MIN_POINTS,
} from '../constants';
import type {
  ClusterAlgorithm,
  ClusteringConfig,
  DatasetKind,
  Linkage,
} from '../types';

export interface ClusteringControlsProps {
  config: ClusteringConfig;
  showTruth: boolean;
  running: boolean;
  speed: number;
  onPlay: () => void;
  onPause: () => void;
  onStep: () => void;
  onReset: () => void;
  onSolve: () => void;
  onSpeedChange: (value: number) => void;
  onAlgorithmChange: (value: ClusterAlgorithm) => void;
  onDatasetChange: (value: DatasetKind) => void;
  /** 拖滑块类的改动：改完直接给结果 */
  onTweak: (patch: Partial<ClusteringConfig>) => void;
  onReshuffle: () => void;
  onRollInit: () => void;
  onToggleTruth: () => void;
  onToggleSmartInit: () => void;
}

const algorithmOptions: { value: ClusterAlgorithm; label: string }[] = [
  { value: 'kmeans', label: 'K-means' },
  { value: 'dbscan', label: 'DBSCAN' },
  { value: 'hierarchical', label: '层次' },
];

const datasetOrder: DatasetKind[] = [
  'blobs',
  'moons',
  'circles',
  'varied',
  'uniform',
];

const linkageOptions: { value: Linkage; label: string }[] = [
  { value: 'single', label: '单连接' },
  { value: 'complete', label: '全连接' },
  { value: 'average', label: '平均' },
];

export function ClusteringControls({
  config,
  showTruth,
  running,
  speed,
  onPlay,
  onPause,
  onStep,
  onReset,
  onSolve,
  onSpeedChange,
  onAlgorithmChange,
  onDatasetChange,
  onTweak,
  onReshuffle,
  onRollInit,
  onToggleTruth,
  onToggleSmartInit,
}: ClusteringControlsProps) {
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
          max={30}
          unit=" 步/帧"
          onChange={onSpeedChange}
        />
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

      <ControlGroup title="数据">
        <div className="grid grid-cols-3 gap-1.5">
          {datasetOrder.map(kind => (
            <ActionButton
              key={kind}
              variant={kind === config.dataset ? 'primary' : 'ghost'}
              onClick={() => onDatasetChange(kind)}
              className="text-xs"
            >
              {datasetLabels[kind].label}
            </ActionButton>
          ))}
        </div>
        <p className="text-xs leading-relaxed text-faint">
          {datasetLabels[config.dataset].blurb}
        </p>
        <SliderControl
          label="点数"
          value={config.pointCount}
          min={MIN_POINTS}
          max={MAX_POINTS}
          step={20}
          onChange={value => onTweak({ pointCount: value })}
        />
        <ActionButton
          onClick={onReshuffle}
          className="text-xs"
          title="换一份数据（G）"
        >
          <Shuffle />
          换一份数据
        </ActionButton>
      </ControlGroup>

      {config.algorithm === 'dbscan' ? (
        <ControlGroup title="DBSCAN 的两个旋钮">
          <SliderControl
            label="eps 邻域半径"
            value={config.eps}
            min={MIN_EPS}
            max={MAX_EPS}
            step={0.005}
            format={value => value.toFixed(3)}
            hint="多近算「挨着」"
            onChange={value => onTweak({ eps: value })}
          />
          <SliderControl
            label="minPts"
            value={config.minPts}
            min={2}
            max={16}
            hint="邻域里有这么多点才算核心点"
            onChange={value => onTweak({ minPts: value })}
          />
          <p className="text-xs leading-relaxed text-faint">
            慢慢拖 eps 看吻合度：小了簇碎成渣、噪声一片，大了两个簇直接并成
            一个。中间那段「刚刚好」比想象的窄得多 —— 这就是它的代价。
          </p>
        </ControlGroup>
      ) : (
        <ControlGroup title="簇数 K">
          <SliderControl
            label="K"
            value={config.k}
            min={MIN_K}
            max={MAX_K}
            hint="K-means 和层次聚类都得先说要几个"
            onChange={value => onTweak({ k: value })}
          />
          <p className="text-xs leading-relaxed text-faint">
            K 给错了它们也照分不误，而且分得很自信。DBSCAN 则完全不需要 这个数
            —— 簇数由数据自己说了算。
          </p>
        </ControlGroup>
      )}

      {config.algorithm === 'kmeans' ? (
        <ControlGroup title="初始中心">
          <ToggleControl
            label="K-means++ 初始化"
            checked={config.smartInit}
            onChange={onToggleSmartInit}
          />
          <ActionButton
            onClick={onRollInit}
            className="text-xs"
            title="重掷初始中心（I）"
          >
            <Dices />
            重掷初始中心
          </ActionButton>
          <p className="text-xs leading-relaxed text-faint">
            数据一个点都不动，只重挑一次起点。关掉 K-means++ 多掷几次，
            总有一次会收敛到明显更差的划分 —— 而它照样报告「已收敛」。
          </p>
        </ControlGroup>
      ) : null}

      {config.algorithm === 'hierarchical' ? (
        <ControlGroup title="连接方式">
          <SegmentedControl<Linkage>
            value={config.linkage}
            options={linkageOptions}
            onChange={value => onTweak({ linkage: value })}
          />
          <p className="text-xs leading-relaxed text-faint">
            两个簇有多近：取最近的一对点（单）、最远的一对（全）、还是所有
            点对的平均。在月牙和同心圆上换着试 —— 只有单连接追得出非凸的形状。
          </p>
        </ControlGroup>
      ) : null}

      <ControlGroup title="对照">
        <ToggleControl
          label="叠加真实分组"
          checked={showTruth}
          onChange={onToggleTruth}
        />
        <p className="text-xs leading-relaxed text-faint">
          打开后每个点会描一圈真值的颜色。填充和描边对不上的点，
          就是被分错的那些 —— 底下那个吻合度数字，量的正是这件事。
        </p>
      </ControlGroup>
    </>
  );
}
