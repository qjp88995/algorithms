import { Link, Outlet } from '@tanstack/react-router';
import { Binary } from 'lucide-react';

import { cn } from '@/lib/cn';
import { groupByCategory } from '@/lib/registry';

/** 全站骨架：左侧按分类列出所有算法，右侧是当前路由 */
export function RootLayout() {
  const groups = groupByCategory();

  return (
    <div className="flex h-full">
      <aside className="flex w-56 shrink-0 flex-col border-r border-line bg-surface">
        <Link
          to="/"
          className="flex items-center gap-2 border-b border-line px-4 py-4 text-sm font-medium"
        >
          <Binary className="size-4.5 text-accent" />
          算法演示
        </Link>

        <nav className="flex flex-1 flex-col gap-5 overflow-y-auto p-3">
          {groups.map(([category, items]) => (
            <div key={category} className="flex flex-col gap-1">
              <span className="px-2 text-xs tracking-widest text-faint">
                {category}
              </span>
              {items.map(item => (
                <Link
                  key={item.id}
                  to={item.path}
                  className="rounded-md px-2 py-1.5 text-sm text-muted transition-colors duration-120 hover:bg-raised hover:text-ink"
                  activeProps={{ className: cn('bg-raised text-ink') }}
                >
                  {item.name}
                </Link>
              ))}
            </div>
          ))}
        </nav>
      </aside>

      <main className="min-w-0 flex-1">
        <Outlet />
      </main>
    </div>
  );
}
