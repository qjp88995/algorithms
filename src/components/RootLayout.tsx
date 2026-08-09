import { Outlet } from '@tanstack/react-router';

import { useCommandPalette } from '@/lib/use-command-palette';

import { CommandPalette } from './CommandPalette';
import { HotkeyHelp } from './HotkeyHelp';
import { HotkeyProvider } from './HotkeyProvider';
import { NavRail } from './NavRail';

/**
 * 全站骨架：左侧图标导航条 + 右侧路由内容。
 * 整页锁死视口高度，滚动交给各栏自己处理。
 */
export function RootLayout() {
  const { open, setOpen } = useCommandPalette();

  return (
    <HotkeyProvider>
      <div className="flex h-full overflow-hidden">
        <NavRail onOpenPalette={() => setOpen(true)} />
        <main className="min-w-0 flex-1">
          <Outlet />
        </main>
        <CommandPalette open={open} onClose={() => setOpen(false)} />
        <HotkeyHelp />
      </div>
    </HotkeyProvider>
  );
}
