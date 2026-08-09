import {
  ControlGroup,
  SegmentedControl,
  SliderControl,
  ToggleControl,
} from '@/components/controls';
import { cn } from '@/lib/cn';

import {
  elementaryPresets,
  MAX_CELL_SIZE,
  MAX_DENSITY,
  MAX_SPEED,
  MIN_CELL_SIZE,
  MIN_DENSITY,
  MIN_SPEED,
  rulePresets,
} from '../constants';
import { formatRule, parseRule } from '../life';
import { patterns } from '../patterns';
import type { CellularConfig, LifeRule } from '../types';
import { ElementaryRuleEditor, LifeRuleEditor } from './RuleEditor';

export interface CellularControlsProps {
  config: CellularConfig;
  patternId: string | null;
  onPatch: (patch: Partial<CellularConfig>) => void;
  onRuleChange: (rule: LifeRule) => void;
  onRuleNumberChange: (rule: number) => void;
  onDimensionChange: (dimension: CellularConfig['dimension']) => void;
  onSeedChange: (seed: CellularConfig['seed']) => void;
  onPatternSelect: (id: string | null) => void;
}

export function CellularControls({
  config,
  patternId,
  onPatch,
  onRuleChange,
  onRuleNumberChange,
  onDimensionChange,
  onSeedChange,
  onPatternSelect,
}: CellularControlsProps) {
  const is2d = config.dimension === '2d';
  const notation = formatRule(config.rule);
  const activePreset = rulePresets.find(item => item.notation === notation);
  const activeElementary = elementaryPresets.find(
    item => item.rule === config.ruleNumber
  );
  const held = patterns.find(item => item.id === patternId);

  return (
    <>
      <ControlGroup title="维度">
        <SegmentedControl
          value={config.dimension}
          options={[
            { value: '2d', label: '二维 · 生命游戏' },
            { value: '1d', label: '一维 · 初等' },
          ]}
          onChange={onDimensionChange}
        />
      </ControlGroup>

      {is2d ? (
        <>
          <ControlGroup title="规则">
            <div className="flex flex-col gap-0.5">
              {rulePresets.map(preset => (
                <PresetRow
                  key={preset.id}
                  active={preset.notation === notation}
                  label={preset.label}
                  aside={preset.notation}
                  onClick={() => onRuleChange(parseRule(preset.notation))}
                />
              ))}
            </div>
            <p className="text-xs text-faint">
              {activePreset?.blurb ??
                '自定义规则 —— 262144 条 Life-like 规则里的一条，多数都很无聊。'}
            </p>
            <LifeRuleEditor rule={config.rule} onChange={onRuleChange} />
          </ControlGroup>

          <ControlGroup title="图案">
            <div className="grid grid-cols-2 gap-1">
              {patterns.map(pattern => (
                <button
                  key={pattern.id}
                  type="button"
                  aria-pressed={pattern.id === patternId}
                  onClick={() => onPatternSelect(pattern.id)}
                  className={cn(
                    'rounded-lg px-2 py-1.5 text-xs transition-colors duration-120',
                    pattern.id === patternId
                      ? 'bg-accent text-accent-ink font-medium'
                      : 'bg-raised text-muted hover:text-ink'
                  )}
                >
                  {pattern.label}
                </button>
              ))}
            </div>
            <p className="text-xs text-faint">
              {held
                ? `${held.blurb} 现在点画布放下它。`
                : '选一个，再点画布把它放下去。'}
            </p>
          </ControlGroup>
        </>
      ) : (
        <ControlGroup title="规则">
          <div className="flex flex-col gap-0.5">
            {elementaryPresets.map(preset => (
              <PresetRow
                key={preset.rule}
                active={preset.rule === config.ruleNumber}
                label={preset.label}
                aside={preset.className}
                onClick={() => onRuleNumberChange(preset.rule)}
              />
            ))}
          </div>
          <p className="text-xs text-faint">
            {activeElementary?.blurb ??
              '256 条规则里的一条。多数要么很快归于空白，要么一片规整的斜纹。'}
          </p>
          <SliderControl
            label="规则编号"
            value={config.ruleNumber}
            min={0}
            max={255}
            onChange={value => onRuleNumberChange(value)}
            hint="拖着扫一遍：绝大多数编号都平平无奇"
          />
          <ElementaryRuleEditor
            rule={config.ruleNumber}
            onChange={onRuleNumberChange}
          />
        </ControlGroup>
      )}

      <ControlGroup title="初始与边界">
        {is2d ? (
          <>
            <SegmentedControl
              label="边界"
              value={config.edge}
              options={[
                { value: 'torus', label: '环形' },
                { value: 'bounded', label: '有界' },
              ]}
              onChange={edge => onPatch({ edge })}
            />
            <SliderControl
              label="随机密度"
              value={config.density}
              min={MIN_DENSITY}
              max={MAX_DENSITY}
              step={0.02}
              onChange={density => onPatch({ density })}
              format={value => `${Math.round(value * 100)}%`}
              hint="「随机撒点」按这个比例填充"
            />
          </>
        ) : (
          <>
            <SegmentedControl
              label="第一行"
              value={config.seed}
              options={[
                { value: 'single', label: '单个细胞' },
                { value: 'random', label: '随机' },
              ]}
              onChange={onSeedChange}
            />
            <SliderControl
              label="随机密度"
              value={config.density}
              min={MIN_DENSITY}
              max={MAX_DENSITY}
              step={0.02}
              onChange={density => onPatch({ density })}
              format={value => `${Math.round(value * 100)}%`}
              hint="Rule 184 的堵车临界点就在 50% 附近"
            />
          </>
        )}
      </ControlGroup>

      <ControlGroup title="演化">
        <SliderControl
          label="速度"
          value={config.speed}
          min={MIN_SPEED}
          max={MAX_SPEED}
          unit=" 代/秒"
          onChange={speed => onPatch({ speed })}
        />
        <SliderControl
          label="格子大小"
          value={config.cellSize}
          min={MIN_CELL_SIZE}
          max={MAX_CELL_SIZE}
          unit=" px"
          onChange={cellSize => onPatch({ cellSize })}
          hint="调小就是换一张更大的网格，画布会重排"
        />
      </ControlGroup>

      <ControlGroup title="显示">
        {is2d ? (
          <>
            <ToggleControl
              label="按年龄着色"
              checked={config.ageColoring}
              onChange={ageColoring => onPatch({ ageColoring })}
            />
            <ToggleControl
              label="死亡余晖"
              checked={config.decayTrails}
              onChange={decayTrails => onPatch({ decayTrails })}
            />
          </>
        ) : null}
        <ToggleControl
          label="网格线"
          checked={config.showGrid}
          onChange={showGrid => onPatch({ showGrid })}
        />
      </ControlGroup>
    </>
  );
}

function PresetRow({
  active,
  label,
  aside,
  onClick,
}: {
  active: boolean;
  label: string;
  aside: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        'flex items-baseline justify-between gap-2 rounded-lg px-2 py-1.5 text-left text-sm transition-colors duration-120',
        active
          ? 'bg-raised text-ink'
          : 'text-muted hover:bg-raised hover:text-ink'
      )}
    >
      <span>{label}</span>
      <span
        className={cn(
          'font-mono text-xs',
          active ? 'text-accent' : 'text-faint'
        )}
      >
        {aside}
      </span>
    </button>
  );
}
