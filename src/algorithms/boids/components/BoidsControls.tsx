import {
  ActionButton,
  ControlGroup,
  SegmentedControl,
  SliderControl,
  StatList,
  ToggleControl,
} from '@/components/controls';

import { shapePresets, speciesPresets } from '../constants';
import type {
  BoidsConfig,
  BoidsPreset,
  DemoStats,
  EdgeMode,
  PerceptionMode,
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
  const topological = config.perception === 'topological';
  const activeIsSpecies = speciesPresets.some(item => item.id === presetId);
  const activePreset = [...speciesPresets, ...shapePresets].find(
    item => item.id === presetId
  );

  return (
    <>
      <ControlGroup title="物种">
        <PresetRow
          presets={speciesPresets}
          activeId={presetId}
          onSelect={onPresetSelect}
        />
        <p className="text-xs leading-relaxed text-faint">
          {activeIsSpecies && activePreset
            ? activePreset.description
            : '鸟和鱼在算法上没有区别，差的是感知方式和运动约束。'}
        </p>
      </ControlGroup>

      <ControlGroup title="形态">
        <PresetRow
          presets={shapePresets}
          activeId={presetId}
          onSelect={onPresetSelect}
        />
        {!activeIsSpecies && activePreset ? (
          <p className="text-xs leading-relaxed text-faint">
            {activePreset.description}
          </p>
        ) : null}
      </ControlGroup>

      <ControlGroup title="感知方式">
        <SegmentedControl<PerceptionMode>
          value={config.perception}
          options={[
            { value: 'metric', label: '度量' },
            { value: 'topological', label: '拓扑' },
          ]}
          onChange={value => onConfigChange({ perception: value })}
        />
        <p className="text-xs leading-relaxed text-faint">
          {topological
            ? '固定跟最近的 k 个同伴互动，不论多远。把群拉稀疏也不会解体 —— 真实椋鸟群用的就是这种。'
            : '只看视野半径内的同伴。一旦群体变稀疏，邻居数骤减，容易失联解体。'}
        </p>
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

      <ControlGroup title="感知范围">
        {topological ? (
          <SliderControl
            label="邻居个数 k"
            value={config.neighborCount}
            min={1}
            max={16}
            unit=" 个"
            hint="椋鸟的实测值是 6–7 个"
            onChange={value => onConfigChange({ neighborCount: value })}
          />
        ) : (
          <SliderControl
            label="视野半径"
            value={config.perceptionRadius}
            min={10}
            max={160}
            unit=" px"
            onChange={value => onConfigChange({ perceptionRadius: value })}
          />
        )}
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
            { value: 'predator', label: '捕食者' },
          ]}
          onChange={onInteractionChange}
        />
        {interaction === 'predator' ? (
          <p className="text-xs leading-relaxed text-faint">
            近距离爆散、同时聚合力加倍。慢慢划过群体看喷泉效应，
            停在群中间看饵球 —— 两者都不是写死的动作。
          </p>
        ) : null}
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
    </>
  );
}

function PresetRow({
  presets,
  activeId,
  onSelect,
}: {
  presets: BoidsPreset[];
  activeId: string;
  onSelect: (id: string) => void;
}) {
  return (
    <div className="grid grid-cols-2 gap-1.5">
      {presets.map(preset => (
        <ActionButton
          key={preset.id}
          variant={preset.id === activeId ? 'primary' : 'ghost'}
          onClick={() => onSelect(preset.id)}
          className="text-xs"
          title={preset.description}
        >
          {preset.label}
        </ActionButton>
      ))}
    </div>
  );
}
