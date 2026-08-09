import { useEffect, useRef, useState } from 'react';

import { useNavigate } from '@tanstack/react-router';
import { Search } from 'lucide-react';

import { cn } from '@/lib/cn';
import { type AlgorithmMeta, searchAlgorithms } from '@/lib/registry';

/**
 * ⌘K / Ctrl+K 打开的算法搜索面板。
 *
 * 关闭时整个对话框卸载，输入框和光标位置随之回到初值 ——
 * 比在 effect 里手动重置 state 干净，也不会引起级联渲染。
 */
export function CommandPalette({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  if (!open) return null;
  return <PaletteDialog onClose={onClose} />;
}

function PaletteDialog({ onClose }: { onClose: () => void }) {
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState('');
  const [cursor, setCursor] = useState(0);

  const results = searchAlgorithms(query);
  // 结果变短后光标可能越界，取值时钳制，不额外同步 state
  const activeIndex = Math.min(cursor, Math.max(results.length - 1, 0));

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const go = (item: AlgorithmMeta | undefined) => {
    if (!item) return;
    navigate({ to: item.path });
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/50 pt-32"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg overflow-hidden rounded-xl border border-line bg-surface shadow-2xl shadow-black/50"
        onClick={event => event.stopPropagation()}
      >
        <div className="flex items-center gap-2 border-b border-line px-4">
          <Search className="size-4 shrink-0 text-faint" />
          <input
            ref={inputRef}
            value={query}
            placeholder="搜索算法、分类或标签…"
            className="flex-1 bg-transparent py-3 text-sm outline-none placeholder:text-faint"
            onChange={event => {
              setQuery(event.target.value);
              setCursor(0);
            }}
            onKeyDown={event => {
              if (event.key === 'Escape') onClose();
              if (event.key === 'Enter') go(results[activeIndex]);
              if (event.key === 'ArrowDown') {
                event.preventDefault();
                setCursor(index => Math.min(index + 1, results.length - 1));
              }
              if (event.key === 'ArrowUp') {
                event.preventDefault();
                setCursor(index => Math.max(index - 1, 0));
              }
            }}
          />
        </div>

        <div className="max-h-80 overflow-y-auto p-2">
          {results.length === 0 ? (
            <p className="px-3 py-6 text-center text-sm text-faint">
              没有匹配的算法
            </p>
          ) : (
            results.map((item, index) => {
              const Icon = item.icon;
              return (
                <button
                  key={item.id}
                  type="button"
                  onMouseEnter={() => setCursor(index)}
                  onClick={() => go(item)}
                  className={cn(
                    'flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left transition-colors duration-120',
                    index === activeIndex ? 'bg-raised' : 'hover:bg-raised'
                  )}
                >
                  <Icon className="size-4 shrink-0 text-accent" />
                  <span className="text-sm">{item.name}</span>
                  <span className="font-mono text-xs text-faint">
                    {item.enName}
                  </span>
                  <span className="ml-auto text-xs text-faint">
                    {item.category}
                  </span>
                </button>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
