import { Keyboard } from 'lucide-react';

import { HELP_KEY, type Hotkey, keyLabel, useHotkeyHelp } from '@/lib/hotkeys';

/**
 * `?` 唤出的快捷键速查表。
 *
 * 内容不是写死的清单，而是此刻真正注册着的绑定 —— 所以换个页面看到的
 * 就是这个页面能按的键，也不会出现表和实现对不上的情况。
 * 和命令面板一样，关闭时整个对话框卸载。
 */
export function HotkeyHelp() {
  const { open, close, list } = useHotkeyHelp();
  if (!open) return null;
  return <HelpDialog hotkeys={list()} onClose={close} />;
}

function HelpDialog({
  hotkeys,
  onClose,
}: {
  hotkeys: Hotkey[];
  onClose: () => void;
}) {
  const groups = new Map<string, Hotkey[]>();
  for (const item of hotkeys) {
    const list = groups.get(item.group);
    if (list) list.push(item);
    else groups.set(item.group, [item]);
  }
  // `?` 由 Provider 直接处理，不在注册表里，这里补一条免得表上没有它自己
  groups.get('通用')?.push({
    key: HELP_KEY,
    label: '打开这张速查表',
    group: '通用',
    run: () => {},
  });

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/50 pt-32"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md overflow-hidden rounded-xl border border-line bg-surface shadow-2xl shadow-black/50"
        onClick={event => event.stopPropagation()}
      >
        <div className="flex items-center gap-2 border-b border-line px-4 py-3">
          <Keyboard className="size-4 shrink-0 text-faint" />
          <span className="text-sm font-medium">快捷键</span>
          <span className="ml-auto font-mono text-xs text-faint">Esc 关闭</span>
        </div>

        <div className="flex max-h-[60vh] flex-col gap-4 overflow-y-auto p-4">
          {[...groups].map(([group, items]) => (
            <div key={group} className="flex flex-col gap-1.5">
              <span className="text-xs tracking-widest text-faint">
                {group}
              </span>
              {items.map(item => (
                <div key={`${group}:${item.key}`} className="flex gap-3">
                  <kbd className="min-w-14 shrink-0 rounded border border-line bg-raised px-1.5 py-0.5 text-center font-mono text-xs text-ink">
                    {keyLabel(item.key)}
                  </kbd>
                  <span className="text-sm text-muted">{item.label}</span>
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
