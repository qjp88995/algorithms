import type { ReactNode } from 'react';

import {
  ControlGroup,
  SliderControl,
  ToggleControl,
} from '@/components/controls';
import { cn } from '@/lib/cn';

import {
  MAX_BRUSH,
  MAX_CELL_SIZE,
  MAX_SPEED,
  MAX_SPREAD,
  MIN_BRUSH,
  MIN_CELL_SIZE,
  MIN_SPEED,
  MIN_SPREAD,
} from '../constants';
import { EMPTY, MATERIALS, PALETTE } from '../materials';
import { scenes } from '../scenes';
import type { SandConfig } from '../types';

/** 开关底下补一句「关掉会怎样」—— 这一组的意义全在关掉之后 */
function Explained({ children, hint }: { children: ReactNode; hint: string }) {
  return (
    <div className="flex flex-col gap-1">
      {children}
      <span className="text-xs text-faint">{hint}</span>
    </div>
  );
}

export function SandControls({
  config,
  sceneId,
  onPatch,
  onSceneSelect,
  onMaterialSelect,
}: {
  config: SandConfig;
  sceneId: string;
  onPatch: (next: Partial<SandConfig>) => void;
  onSceneSelect: (id: string) => void;
  onMaterialSelect: (material: number) => void;
}) {
  const scene = scenes.find(item => item.id === sceneId);
  const material = MATERIALS[config.material];

  return (
    <>
      <ControlGroup title="场景">
        <div className="grid grid-cols-2 gap-1">
          {scenes.map(item => (
            <button
              key={item.id}
              type="button"
              onClick={() => onSceneSelect(item.id)}
              className={cn(
                'rounded-md px-2 py-1.5 text-xs transition-colors duration-120',
                item.id === sceneId
                  ? 'bg-accent text-accent-ink font-medium'
                  : 'bg-raised text-muted hover:text-ink'
              )}
            >
              {item.label}
            </button>
          ))}
        </div>
        {scene ? (
          <p className="text-xs leading-relaxed text-faint">{scene.blurb}</p>
        ) : null}
      </ControlGroup>

      <ControlGroup title="画笔">
        <div className="grid grid-cols-3 gap-1">
          {PALETTE.map(id => {
            const item = MATERIALS[id];
            const selected = id === config.material;
            return (
              <button
                key={id}
                type="button"
                onClick={() => onMaterialSelect(id)}
                title={item.blurb}
                className={cn(
                  'flex items-center gap-1.5 rounded-md px-1.5 py-1.5 text-xs transition-colors duration-120',
                  selected
                    ? 'bg-accent text-accent-ink font-medium'
                    : 'bg-raised text-muted hover:text-ink'
                )}
              >
                <span
                  className={cn(
                    'size-3 shrink-0 rounded-sm',
                    id === EMPTY && 'ring-1 ring-faint'
                  )}
                  style={{ background: item.color }}
                />
                {item.name}
              </button>
            );
          })}
        </div>
        <p className="text-xs leading-relaxed text-faint">{material.blurb}</p>
        <p className="text-xs leading-relaxed text-faint">
          会流动的东西只落在<span className="text-muted">空格</span>
          里，盖不掉已有的材质 —— 想烧木头就把火放在它旁边，让规则自己去点。
          石头和木头可以直接盖上去，橡皮擦一切。
        </p>
        <SliderControl
          label="笔刷半径"
          value={config.brushSize}
          min={MIN_BRUSH}
          max={MAX_BRUSH}
          unit=" 格"
          onChange={brushSize => onPatch({ brushSize })}
        />
      </ControlGroup>

      <ControlGroup title="模拟">
        <SliderControl
          label="像素大小"
          value={config.cellSize}
          min={MIN_CELL_SIZE}
          max={MAX_CELL_SIZE}
          unit=" px"
          hint="调小 = 格子更多、画面更细，也更吃 CPU"
          onChange={cellSize => onPatch({ cellSize })}
        />
        <SliderControl
          label="模拟速度"
          value={config.speed}
          min={MIN_SPEED}
          max={MAX_SPEED}
          unit=" 步/秒"
          hint="60 是满速。调到个位数看慢动作 —— 挖开水面时，扰动怎么从缺口一圈圈传到远端，只有慢放才看得清"
          onChange={speed => onPatch({ speed })}
        />
        <SliderControl
          label="液体铺开距离"
          value={config.liquidSpread}
          min={MIN_SPREAD}
          max={MAX_SPREAD}
          unit=" 格"
          hint="一帧最多横着挪几格，也就是黏稠度。调到 1 水流得像蜂蜜（岩浆本来就是 1）"
          onChange={liquidSpread => onPatch({ liquidSpread })}
        />
      </ControlGroup>

      <ControlGroup title="实现细节">
        <Explained hint="关掉就是每帧全屏扫一遍。看底下那行「活跃块」和 fps 的变化">
          <ToggleControl
            label="脏块跳过"
            checked={config.useChunks}
            onChange={useChunks => onPatch({ useChunks })}
          />
        </Explained>
        <Explained hint="把「这一帧算了哪几块」画出来：亮框在算，暗框睡着">
          <ToggleControl
            label="显示块边框"
            checked={config.showChunks}
            onChange={showChunks => onPatch({ showChunks })}
          />
        </Explained>
        <Explained hint="关掉改成自顶向下：一柱沙不再整体下落，会从底下一粒粒漏散">
          <ToggleControl
            label="自底向上扫"
            checked={config.bottomUp}
            onChange={bottomUp => onPatch({ bottomUp })}
          />
        </Explained>
        <Explained hint="关掉就固定从左往右扫：沙堆会集体朝一侧漂，堆出的坡也不对称">
          <ToggleControl
            label="水平方向逐帧翻转"
            checked={config.alternateScan}
            onChange={alternateScan => onPatch({ alternateScan })}
          />
        </Explained>
      </ControlGroup>
    </>
  );
}
