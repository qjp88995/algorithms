import { type ReactNode, useState } from 'react';

import { ChevronRight, X } from 'lucide-react';

import { cn } from '@/lib/cn';
import type { AlgorithmMeta } from '@/lib/registry';

/**
 * 算法页面的统一外壳 —— 工作台式三栏：
 *
 *   细标题条
 *   ├─ 中栏：演示区，独占剩余高度，永不滚动
 *   └─ 右栏：参数面板，自己独立滚动
 *
 * 原理说明不占布局空间，点标题条上的按钮从画布底部升起浮层，
 * 画布尺寸不变，模拟照常跑（避免开合说明触发 resize 重排）。
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

  return (
    <div className="flex h-full min-h-0 flex-col">
      <header className="flex h-11 shrink-0 items-center gap-3 border-b border-line px-3">
        <h1 className="text-sm font-medium">{meta.name}</h1>
        <span className="font-mono text-xs text-faint">{meta.enName}</span>
        {notes ? (
          <button
            type="button"
            onClick={() => setNotesOpen(value => !value)}
            className={cn(
              'ml-auto flex items-center gap-1 rounded-md px-2 py-1 text-xs transition-colors duration-120',
              notesOpen
                ? 'bg-raised text-ink'
                : 'text-muted hover:bg-raised hover:text-ink'
            )}
          >
            <ChevronRight
              className={cn(
                'size-3.5 transition-transform duration-150',
                notesOpen && 'rotate-90'
              )}
            />
            原理说明
          </button>
        ) : null}
      </header>

      <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
        <div className="relative flex min-h-0 flex-1 flex-col p-3">
          {children}

          {notes && notesOpen ? (
            <div className="absolute inset-x-3 bottom-3 z-20 max-h-[62%] overflow-y-auto rounded-xl border border-line bg-surface/95 p-4 text-sm leading-relaxed text-muted shadow-2xl shadow-black/40 backdrop-blur">
              <button
                type="button"
                onClick={() => setNotesOpen(false)}
                className="float-right rounded-md p-1 text-faint transition-colors duration-120 hover:bg-raised hover:text-ink"
                aria-label="关闭原理说明"
              >
                <X className="size-4" />
              </button>
              {notes}
            </div>
          ) : null}
        </div>

        {controls ? (
          <aside className="flex w-full shrink-0 flex-col gap-6 overflow-y-auto border-line p-3 lg:w-68 lg:border-l">
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
