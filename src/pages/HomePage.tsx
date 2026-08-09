import { Link } from '@tanstack/react-router';
import { ArrowRight } from 'lucide-react';

import { algorithms } from '@/lib/registry';

export function HomePage() {
  return (
    <div className="h-full overflow-y-auto px-6 py-10">
      <div className="mx-auto max-w-4xl">
        <h1 className="text-2xl font-medium">算法演示</h1>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted">
          每个算法一个独立页面，参数实时可调，直接在画布上看它怎么跑起来。
        </p>

        <div className="mt-8 grid gap-3 sm:grid-cols-2">
          {algorithms.map(item => (
            <Link
              key={item.id}
              to={item.path}
              className="group flex flex-col gap-2 rounded-xl border border-line bg-surface p-4 transition-colors duration-120 hover:border-accent"
            >
              <div className="flex items-baseline justify-between gap-2">
                <span className="font-medium">{item.name}</span>
                <ArrowRight className="size-4 text-faint transition-colors duration-120 group-hover:text-accent" />
              </div>
              <span className="font-mono text-xs text-faint">
                {item.enName}
              </span>
              <p className="text-sm leading-relaxed text-muted">
                {item.summary}
              </p>
              <div className="mt-1 flex flex-wrap gap-1.5">
                {item.tags.map(tag => (
                  <span
                    key={tag}
                    className="rounded-md bg-raised px-2 py-0.5 text-xs text-muted"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
