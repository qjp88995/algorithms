import type { ReactNode } from 'react';

import {
  HotkeyHelpContext,
  HotkeyRegistryContext,
  useHotkeyRegistry,
} from '@/lib/hotkeys';

/** 把快捷键注册中心挂到 context 上，全站包一层即可 */
export function HotkeyProvider({ children }: { children: ReactNode }) {
  const { registry, help } = useHotkeyRegistry();

  return (
    <HotkeyRegistryContext value={registry}>
      <HotkeyHelpContext value={help}>{children}</HotkeyHelpContext>
    </HotkeyRegistryContext>
  );
}
