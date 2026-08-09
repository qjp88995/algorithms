import {
  ActionButton,
  ControlGroup,
  SegmentedControl,
  SliderControl,
  StatList,
  ToggleControl,
} from '@/components/controls';

import { presets } from '../constants';
import type {
  BoidsConfig,
  DemoStats,
  EdgeMode,
  PointerInteraction,
} from '../types';

export interface BoidsControlsProps {
  config: BoidsConfig;
  onConfigChange: (patch: Partial<BoidsConfig>) => void;
  presetId: string;
  onPresetSelect: (id: string) => void;
  timeScale: number;
  onTimeScaleChange: (value: number) => void;
  trails: boolean;
  onTrailsChange: (value: boolean) => void;
  colorByHeading: boolean;
  onColorByHeadingChange: (value: boolean) => void;
  interaction: PointerInteraction;
  onInteractionChange: (value: PointerInteraction) => void;
  stats: DemoStats;
}

/** 纯受控的参数面板：自己不持有任何模拟状态 */
export function BoidsControls({
  config,
  onConfigChange,
  presetId,
  onPresetSelect,
  timeScale,
  onTimeScaleChange,
  trails,
  onTrailsChange,
  colorByHeading,
  onColorByHeadingChange,
  interaction,
  onInteractionChange,
  stats,
}: BoidsControlsProps) {
  const activePreset = presets.find(item => item.id === presetId);

  return (
    <div className="flex w-full shrink-0 flex-col gap-6 lg:w-64">
      <ControlGroup title="预设">
        <div className="grid grid-cols-2 gap-1.5">
          {presets.map(preset => (
            <ActionButton
              key={preset.id}
              variant={preset.id === presetId ? 'primary' : 'ghost'}
              onClick={() => onPresetSelect(preset.id)}
              className="text-xs"
            >
              {preset.label}
            </ActionButton>
          ))}
        </div>
        {activePreset ? (
          <p className="text-xs leading-relaxed text-faint">
            {activePreset.description}
          </p>
        ) : null}
      </ControlGroup>

      <ControlGroup title="三条规则的权重">
        <SliderControl
          label="分离 Separation"
          value={config.separationWeight}
          min={0}
          max={3}
          step={0.1}
          onChange={value => onConfigChange({ separationWeight: value })}
        />
        <SliderControl
          label="对齐 Alignment"
          value={config.alignmentWeight}
          min={0}
          max={3}
          step={0.1}
          onChange={value => onConfigChange({ alignmentWeight: value })}
        />
        <SliderControl
          label="聚合 Cohesion"
          value={config.cohesionWeight}
          min={0}
          max={3}
          step={0.1}
          onChange={value => onConfigChange({ cohesionWeight: value })}
        />
      </ControlGroup>

      <ControlGroup title="感知">
        <SliderControl
          label="视野半径"
          value={config.perceptionRadius}
          min={10}
          max={160}
          unit=" px"
          onChange={value => onConfigChange({ perceptionRadius: value })}
        />
        <SliderControl
          label="分离半径"
          value={config.separationRadius}
          min={4}
          max={80}
          unit=" px"
          onChange={value => onConfigChange({ separationRadius: value })}
        />
        <SliderControl
          label="视野角度"
          value={config.fieldOfView}
          min={60}
          max={360}
          unit="°"
          hint="小于 360° 时看不见身后的同伴"
          onChange={value => onConfigChange({ fieldOfView: value })}
        />
      </ControlGroup>

      <ControlGroup title="运动">
        <SliderControl
          label="数量"
          value={config.count}
          min={10}
          max={2000}
          step={10}
          unit=" 只"
          onChange={value => onConfigChange({ count: value })}
        />
        <SliderControl
          label="最大速度"
          value={config.maxSpeed}
          min={40}
          max={320}
          step={5}
          unit=" px/s"
          onChange={value =>
            onConfigChange({
              maxSpeed: value,
              minSpeed: Math.min(config.minSpeed, value),
            })
          }
        />
        <SliderControl
          label="最小速度"
          value={config.minSpeed}
          min={0}
          max={200}
          step={5}
          unit=" px/s"
          onChange={value =>
            onConfigChange({ minSpeed: Math.min(value, config.maxSpeed) })
          }
        />
        <SliderControl
          label="转向力上限"
          value={config.maxForce}
          min={40}
          max={800}
          step={10}
          hint="越小转弯越迟钝，群体越显得有惯性"
          onChange={value => onConfigChange({ maxForce: value })}
        />
        <SliderControl
          label="仿真速度"
          value={timeScale}
          min={0.1}
          max={3}
          step={0.1}
          unit="×"
          onChange={onTimeScaleChange}
        />
        <SegmentedControl<EdgeMode>
          label="边界"
          value={config.edgeMode}
          options={[
            { value: 'wrap', label: '穿越' },
            { value: 'bounce', label: '回避' },
          ]}
          onChange={value => onConfigChange({ edgeMode: value })}
        />
      </ControlGroup>

      <ControlGroup title="鼠标干预">
        <SegmentedControl<PointerInteraction>
          value={interaction}
          options={[
            { value: 'off', label: '关闭' },
            { value: 'attract', label: '吸引' },
            { value: 'repel', label: '驱散' },
          ]}
          onChange={onInteractionChange}
        />
        <SliderControl
          label="作用半径"
          value={config.pointer.radius}
          min={40}
          max={320}
          unit=" px"
          onChange={value =>
            onConfigChange({ pointer: { ...config.pointer, radius: value } })
          }
        />
        <SliderControl
          label="作用强度"
          value={config.pointer.strength}
          min={0.2}
          max={4}
          step={0.1}
          onChange={value =>
            onConfigChange({ pointer: { ...config.pointer, strength: value } })
          }
        />
      </ControlGroup>

      <ControlGroup title="显示">
        <ToggleControl
          label="拖尾轨迹"
          checked={trails}
          onChange={onTrailsChange}
        />
        <ToggleControl
          label="按航向着色"
          checked={colorByHeading}
          onChange={onColorByHeadingChange}
        />
      </ControlGroup>

      <ControlGroup title="群体指标">
        <StatList
          items={[
            {
              label: '极化度',
              value: stats.polarization.toFixed(3),
              hint: '速度方向的一致程度，1 = 完全同向',
            },
            {
              label: '平均速率',
              value: `${stats.averageSpeed.toFixed(0)} px/s`,
            },
            {
              label: '平均邻居',
              value: stats.averageNeighbors.toFixed(1),
              hint: '每只鸟视野内的同伴数量',
            },
          ]}
        />
      </ControlGroup>
    </div>
  );
}
