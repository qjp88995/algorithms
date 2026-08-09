import { type ReactNode, useEffect, useState } from 'react';

import { BookOpen, X } from 'lucide-react';

import { cn } from '@/lib/cn';
import type { AlgorithmMeta } from '@/lib/registry';

/**
 * 算法页面的统一外壳 —— 工作台式三栏：
 *
 *   细标题条
 *   ├─ 中栏：演示区，独占剩余高度，永不滚动
 *   └─ 右栏：参数面板，自己独立滚动
 *
 * 原理说明从右侧滑出，盖在参数面板上而不是画布上 ——
 * 说明里讲的正是画布上发生的事，边读边看才有意义；
 * 画布尺寸也因此完全不变，不会触发重排。
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
  const [notesOpen, setNotesOpen] = useState(false);

  useEffect(() => {
    if (!notesOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setNotesOpen(false);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [notesOpen]);

  return (
    <div className="flex h-full min-h-0 flex-col">
      <header className="flex h-11 shrink-0 items-center gap-3 border-b border-line px-3">
        <h1 className="text-sm font-medium">{meta.name}</h1>
        <span className="font-mono text-xs text-faint">{meta.enName}</span>
        {notes ? (
          <button
            type="button"
            onClick={() => setNotesOpen(value => !value)}
            aria-expanded={notesOpen}
            className={cn(
              'ml-auto flex items-center gap-1.5 rounded-md px-2 py-1 text-xs transition-colors duration-120',
              notesOpen
                ? 'bg-accent text-accent-ink'
                : 'text-muted hover:bg-raised hover:text-ink'
            )}
          >
            <BookOpen className="size-3.5" />
            原理说明
          </button>
        ) : null}
      </header>

      <div className="relative flex min-h-0 flex-1 flex-col lg:flex-row">
        <div className="flex min-h-0 flex-1 flex-col p-3">{children}</div>

        {controls ? (
          <aside className="flex w-full shrink-0 flex-col gap-6 overflow-y-auto border-line p-3 lg:w-68 lg:border-l">
            {controls}
          </aside>
        ) : null}

        {notes ? (
          <aside
            aria-hidden={!notesOpen}
            className={cn(
              'absolute inset-y-0 right-0 z-30 flex w-full flex-col border-l border-line bg-surface shadow-2xl shadow-black/40 transition-transform duration-200 lg:w-100',
              notesOpen
                ? 'translate-x-0'
                : 'pointer-events-none translate-x-full'
            )}
          >
            <div className="flex h-11 shrink-0 items-center justify-between border-b border-line px-3">
              <span className="text-sm font-medium">原理说明</span>
              <button
                type="button"
                onClick={() => setNotesOpen(false)}
                aria-label="关闭原理说明"
                className="rounded-md p-1 text-faint transition-colors duration-120 hover:bg-raised hover:text-ink"
              >
                <X className="size-4" />
              </button>
            </div>
            <div className="flex flex-col gap-5 overflow-y-auto p-4 text-sm leading-relaxed text-muted">
              {notes}
            </div>
          </aside>
        ) : null}
      </div>
    </div>
  );
}
