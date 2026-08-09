import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

/**
 * 全站快捷键。
 *
 * 只支持**单键**：这里要的是看动画时随手能按的键，⌘K 那种带修饰键的
 * 组合仍归命令面板自己处理。带修饰键的事件一律放行，否则 ⌘R
 * 这类浏览器快捷键会被吞掉。
 *
 * 绑定注册进一个集合，而不是各组件自己挂 window 监听：全站只有一个
 * keydown 入口，冲突可判定，`?` 速查表也才有东西可列 ——
 * 按不出来的快捷键等于不存在。
 */
export interface Hotkey {
  /** 直接和 `event.key` 比，大小写不敏感；空格写成 ' ' */
  key: string;
  /** 速查表里的说明 */
  label: string;
  /** 速查表里的分组，同名的并成一段 */
  group: string;
  run: () => void;
}

/** 打开速查表的键。由注册中心自己处理，不进注册表 */
export const HELP_KEY = '?';

type HotkeyStore = { current: Hotkey[] };

interface HotkeyRegistry {
  register: (store: HotkeyStore) => () => void;
  /** 当前生效的全部绑定，按注册先后 —— 速查表打开时读一次 */
  snapshot: () => Hotkey[];
}

interface HotkeyHelp {
  open: boolean;
  setOpen: (value: boolean) => void;
}

export const HotkeyRegistryContext = createContext<HotkeyRegistry | null>(null);
export const HotkeyHelpContext = createContext<HotkeyHelp | null>(null);

/**
 * 注册中心：唯一的 keydown 入口，外加速查表的开关状态。
 * 由 `HotkeyProvider` 装配到 context 上。
 */
export function useHotkeyRegistry() {
  const storesRef = useRef(new Set<HotkeyStore>());
  const [helpOpen, setHelpOpen] = useState(false);

  // 注册表本身恒定，注册者不会因为速查表开合而重挂
  const registry = useMemo<HotkeyRegistry>(
    () => ({
      register: store => {
        storesRef.current.add(store);
        return () => {
          storesRef.current.delete(store);
        };
      },
      snapshot: () => [...storesRef.current].flatMap(store => store.current),
    }),
    []
  );

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      if (isTypingTarget(event.target)) return;

      const key = event.key.toLowerCase();

      // 速查表开着时只认关掉它的键：一边对着表一边误触发很糟
      if (helpOpen) {
        if (key === 'escape' || key === HELP_KEY) {
          event.preventDefault();
          setHelpOpen(false);
        }
        return;
      }
      if (key === HELP_KEY) {
        event.preventDefault();
        setHelpOpen(true);
        return;
      }

      // 后注册的先匹配 —— 页面级绑定该盖过全局的同名键
      for (const store of [...storesRef.current].reverse()) {
        const hit = store.current.find(item => item.key.toLowerCase() === key);
        if (!hit) continue;
        // 顺带挡掉空格在聚焦按钮上引发的第二次点击
        event.preventDefault();
        hit.run();
        return;
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [helpOpen]);

  const help = useMemo<HotkeyHelp>(
    () => ({ open: helpOpen, setOpen: setHelpOpen }),
    [helpOpen]
  );

  return { registry, help };
}

/**
 * 注册一组快捷键，卸载时自动注销。
 *
 * 传进来的数组每次渲染都是新的，所以注册的是一个 ref、内容在 effect 里更新：
 * 否则每渲染一次就要摘挂一次，而这些页面渲染得很频繁。
 */
export function useHotkeys(hotkeys: Hotkey[]) {
  const registry = useContext(HotkeyRegistryContext);
  const store = useRef(hotkeys);

  useEffect(() => {
    store.current = hotkeys;
  });

  useEffect(() => registry?.register(store), [registry]);
}

/** 速查表要的东西：开关状态，以及此刻所有生效的绑定 */
export function useHotkeyHelp() {
  const registry = useContext(HotkeyRegistryContext);
  const help = useContext(HotkeyHelpContext);
  return {
    open: help?.open ?? false,
    show: () => help?.setOpen(true),
    close: () => help?.setOpen(false),
    list: () => registry?.snapshot() ?? [],
  };
}

/** 键位在界面上的写法 */
export function keyLabel(key: string) {
  if (key === ' ') return 'Space';
  return key.length === 1 ? key.toUpperCase() : key;
}

/**
 * 正在输入时不劫持按键。滑块是例外 —— 拖完滑块焦点就留在上面，
 * 这时候按空格想要的显然是播放，而 range 上的空格本来也没有默认行为。
 */
function isTypingTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false;
  if (target.isContentEditable) return true;
  if (target instanceof HTMLInputElement && target.type === 'range') {
    return false;
  }
  return ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName);
}
