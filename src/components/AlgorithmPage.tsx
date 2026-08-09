import type { ReactNode } from 'react';

import type { AlgorithmMeta } from '@/lib/registry';

/**
 * 每个算法页面的统一外壳：顶部标题区 + 演示区 + 画布下方的原理说明。
 *
 * `controls` 是可选的右侧面板 —— 如果某个演示的控件和它自身状态
 * 耦合很紧（比如 Boids），它可以自己排版，这里就不传。
 */
export function AlgorithmPage({
  meta,
  controls,
  notes,
  children,
}: {
  meta: AlgorithmMeta;
  controls?: ReactNode;
  notes?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="flex h-full min-h-0 flex-col">
      <header className="border-b border-line px-6 py-4">
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <h1 className="text-lg font-medium">{meta.name}</h1>
          <span className="font-mono text-xs text-faint">{meta.enName}</span>
        </div>
        <p className="mt-1 max-w-3xl text-sm text-muted">{meta.summary}</p>
      </header>

      <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
        <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-4">
          <div className="min-h-100 flex-1">{children}</div>
          {notes ? (
            <div className="text-sm leading-relaxed text-muted">{notes}</div>
          ) : null}
        </div>

        {controls ? (
          <aside className="flex w-full shrink-0 flex-col gap-6 overflow-y-auto border-line p-4 lg:w-76 lg:border-l">
            {controls}
          </aside>
        ) : null}
      </div>
    </div>
  );
}

/** 原理说明里复用的小节 */
export function NoteSection({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="mb-4 last:mb-0">
      <h2 className="mb-1 text-sm font-medium text-ink">{title}</h2>
      {children}
    </section>
  );
}
