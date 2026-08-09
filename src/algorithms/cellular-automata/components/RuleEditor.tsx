import { cn } from '@/lib/cn';

import { neighborhoodCells, NEIGHBORHOODS, ruleBit } from '../elementary';
import { formatRule } from '../life';
import type { LifeRule } from '../types';

/**
 * 规则本身就是这一页的主控件。
 *
 * 两个编辑器都刻意做成「一格一位」的样子 —— 规则不是一个下拉框里的
 * 名字，它是十几个二进制位。看着 B3/S23 那两行方块，按一下多一个 6，
 * 满屏的行为立刻变成另一个宇宙，这件事只有点得到才有说服力。
 */

const NEIGHBOR_COUNTS = [0, 1, 2, 3, 4, 5, 6, 7, 8];

export function LifeRuleEditor({
  rule,
  onChange,
}: {
  rule: LifeRule;
  onChange: (rule: LifeRule) => void;
}) {
  const toggle = (kind: 'birth' | 'survive', n: number) =>
    onChange({ ...rule, [kind]: rule[kind] ^ (1 << n) });

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-baseline justify-between">
        <span className="text-sm text-muted">规则</span>
        <span className="font-mono text-xs text-ink">{formatRule(rule)}</span>
      </div>

      <RuleRow
        label="出生 B"
        hint="死格恰好有这么多活邻居时活过来"
        mask={rule.birth}
        onToggle={n => toggle('birth', n)}
      />
      <RuleRow
        label="存活 S"
        hint="活格恰好有这么多活邻居时留下来"
        mask={rule.survive}
        onToggle={n => toggle('survive', n)}
      />
    </div>
  );
}

function RuleRow({
  label,
  hint,
  mask,
  onToggle,
}: {
  label: string;
  hint: string;
  mask: number;
  onToggle: (n: number) => void;
}) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-xs text-faint">
        <span className="text-muted">{label}</span> —— {hint}
      </span>
      <div className="grid grid-cols-9 gap-0.5">
        {NEIGHBOR_COUNTS.map(n => {
          const on = ((mask >> n) & 1) === 1;
          return (
            <button
              key={n}
              type="button"
              aria-pressed={on}
              onClick={() => onToggle(n)}
              className={cn(
                'aspect-square rounded font-mono text-xs transition-colors duration-120',
                on
                  ? 'bg-accent text-accent-ink font-medium'
                  : 'bg-raised text-faint hover:text-ink'
              )}
            >
              {n}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/**
 * 初等 CA 的规则表：八种邻域局面，各指定一个输出。
 * 八个输出位拼起来就是 Wolfram 编号 —— 点一下方块，编号跟着变。
 */
export function ElementaryRuleEditor({
  rule,
  onChange,
}: {
  rule: number;
  onChange: (rule: number) => void;
}) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-baseline justify-between">
        <span className="text-sm text-muted">规则表</span>
        <span className="font-mono text-xs text-ink">
          {NEIGHBORHOODS.map(n => ruleBit(rule, n)).join('')}
          <span className="text-faint"> = {rule}</span>
        </span>
      </div>
      <div className="grid grid-cols-8 gap-1">
        {NEIGHBORHOODS.map(neighborhood => {
          const cells = neighborhoodCells(neighborhood);
          const out = ruleBit(rule, neighborhood);
          return (
            <div
              key={neighborhood}
              className="flex flex-col items-center gap-1"
            >
              <div className="flex gap-px">
                {cells.map((cell, index) => (
                  <span
                    key={index}
                    className={cn(
                      'size-2 rounded-xs',
                      cell ? 'bg-muted' : 'bg-line'
                    )}
                  />
                ))}
              </div>
              <button
                type="button"
                aria-pressed={out === 1}
                title={`邻域 ${cells.join('')} → ${out}`}
                onClick={() => onChange(rule ^ (1 << neighborhood))}
                className={cn(
                  'size-4 rounded-xs transition-colors duration-120',
                  out
                    ? 'bg-accent'
                    : 'bg-raised ring-1 ring-line hover:ring-muted'
                )}
              />
            </div>
          );
        })}
      </div>
      <span className="text-xs text-faint">
        上面三格是此刻的左邻、自己、右邻，下面那格是它下一代的样子。
      </span>
    </div>
  );
}
