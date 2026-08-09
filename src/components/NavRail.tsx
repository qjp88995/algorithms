import { useState } from 'react';

import { Link, useRouterState } from '@tanstack/react-router';
import { Binary, Command } from 'lucide-react';

import { cn } from '@/lib/cn';
import { groupByCategory } from '@/lib/registry';

/**
 * 左侧图标导航条。
 *
 * 收起态只有 56px 宽；展开时不改变布局宽度，而是让浮层盖在画布上方
 * （外层占位 div 宽度固定，nav 是 absolute）—— 这样画布不会因为
 * 鼠标扫过导航就被挤压、触发一次 resize 和模拟重排。
 */
export function NavRail({ onOpenPalette }: { onOpenPalette: () => void }) {
  const [expanded, setExpanded] = useState(false);
  const groups = groupByCategory();
  const currentPath = useRouterState({
    select: state => state.location.pathname,
  });

  return (
    <div className="relative w-14 shrink-0">
      <nav
        className={cn(
          'absolute inset-y-0 left-0 z-40 flex flex-col overflow-hidden border-r border-line bg-surface transition-[width] duration-150',
          expanded ? 'w-56 shadow-xl shadow-black/30' : 'w-14'
        )}
        onPointerEnter={() => setExpanded(true)}
        onPointerLeave={() => setExpanded(false)}
        onFocusCapture={() => setExpanded(true)}
        onBlurCapture={() => setExpanded(false)}
      >
        <Link
          to="/"
          className="flex h-14 shrink-0 items-center gap-3 border-b border-line px-4 text-sm font-medium whitespace-nowrap"
          title="算法演示"
        >
          <Binary className="size-5 shrink-0 text-accent" />
          <span className={cn(!expanded && 'opacity-0')}>算法演示</span>
        </Link>

        <div className="flex flex-1 flex-col gap-4 overflow-x-hidden overflow-y-auto py-3">
          {groups.map(([category, items]) => (
            <div key={category} className="flex flex-col gap-1">
              <span
                className={cn(
                  'px-4 text-xs tracking-widest whitespace-nowrap text-faint transition-opacity duration-150',
                  expanded ? 'opacity-100' : 'opacity-0'
                )}
              >
                {category}
              </span>
              {items.map(item => {
                const Icon = item.icon;
                const active = currentPath === item.path;
                return (
                  <Link
                    key={item.id}
                    to={item.path}
                    title={item.name}
                    className={cn(
                      'mx-2 flex items-center gap-3 rounded-md px-2 py-2 text-sm whitespace-nowrap transition-colors duration-120',
                      active
                        ? 'bg-raised text-ink'
                        : 'text-muted hover:bg-raised hover:text-ink'
                    )}
                  >
                    <Icon
                      className={cn('size-5 shrink-0', active && 'text-accent')}
                    />
                    <span className={cn(!expanded && 'opacity-0')}>
                      {item.name}
                    </span>
                  </Link>
                );
              })}
            </div>
          ))}
        </div>

        <button
          type="button"
          onClick={onOpenPalette}
          title="搜索算法（⌘K）"
          className="m-2 flex items-center gap-3 rounded-md px-2 py-2 text-sm whitespace-nowrap text-muted transition-colors duration-120 hover:bg-raised hover:text-ink"
        >
          <Command className="size-5 shrink-0" />
          <span className={cn(!expanded && 'opacity-0')}>搜索算法</span>
        </button>
      </nav>
    </div>
  );
}
