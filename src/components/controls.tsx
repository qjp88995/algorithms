import type { ComponentProps, ReactNode } from 'react';

import { cn } from '@/lib/cn';

/** 控制面板里的一组控件，带小标题 */
export function ControlGroup({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="flex flex-col gap-3">
      <h3 className="text-xs font-medium tracking-widest text-faint uppercase">
        {title}
      </h3>
      {children}
    </section>
  );
}

export function SliderControl({
  label,
  value,
  min,
  max,
  step = 1,
  unit,
  hint,
  format,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  unit?: string;
  hint?: string;
  /** 数值另有读法时用它，比如「一天里的第几分钟」要显示成钟点 */
  format?: (value: number) => string;
  onChange: (value: number) => void;
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="flex items-baseline justify-between gap-2">
        <span className="text-sm text-muted">{label}</span>
        <span className="font-mono text-xs text-ink tabular-nums">
          {format
            ? format(value)
            : Number.isInteger(step)
              ? value
              : value.toFixed(2)}
          {unit ? <span className="text-faint">{unit}</span> : null}
        </span>
      </span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={event => onChange(Number(event.target.value))}
      />
      {hint ? <span className="text-xs text-faint">{hint}</span> : null}
    </label>
  );
}

export function ToggleControl({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="flex cursor-pointer items-center justify-between gap-3">
      <span className="text-sm text-muted">{label}</span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={cn(
          'relative h-5 w-9 shrink-0 rounded-full transition-colors duration-150',
          checked ? 'bg-accent' : 'bg-line'
        )}
      >
        <span
          className={cn(
            'absolute top-0.5 size-4 rounded-full bg-canvas transition-all duration-150',
            checked ? 'left-4.5' : 'left-0.5'
          )}
        />
      </button>
    </label>
  );
}

export function SegmentedControl<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label?: string;
  value: T;
  options: { value: T; label: string }[];
  onChange: (value: T) => void;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      {label ? <span className="text-sm text-muted">{label}</span> : null}
      <div className="flex gap-1 rounded-lg bg-canvas p-1">
        {options.map(option => (
          <button
            key={option.value}
            type="button"
            onClick={() => onChange(option.value)}
            className={cn(
              'flex-1 rounded-md px-2 py-1 text-xs transition-colors duration-120',
              option.value === value
                ? 'bg-accent text-accent-ink font-medium'
                : 'text-muted hover:text-ink'
            )}
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  );
}

export function ActionButton({
  variant = 'ghost',
  className,
  children,
  ...props
}: ComponentProps<'button'> & { variant?: 'primary' | 'ghost' }) {
  return (
    <button
      type="button"
      className={cn(
        'flex items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-sm transition-colors duration-120',
        '**:[svg]:size-4',
        variant === 'primary'
          ? 'bg-accent text-accent-ink font-medium hover:opacity-90'
          : 'bg-raised text-muted hover:text-ink',
        className
      )}
      {...props}
    >
      {children}
    </button>
  );
}

export function StatList({
  items,
}: {
  items: { label: string; value: string; hint?: string }[];
}) {
  return (
    <dl className="flex flex-col gap-2">
      {items.map(item => (
        <div key={item.label} className="flex items-baseline justify-between">
          <dt className="text-sm text-muted" title={item.hint}>
            {item.label}
          </dt>
          <dd className="font-mono text-xs text-ink tabular-nums">
            {item.value}
          </dd>
        </div>
      ))}
    </dl>
  );
}
