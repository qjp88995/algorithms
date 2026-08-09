import { AlgorithmPage } from '@/components/AlgorithmPage';
import { useHotkeys } from '@/lib/hotkeys';
import { findByPath } from '@/lib/registry';

import { SandBoard } from './components/SandBoard';
import { SandControls } from './components/SandControls';
import { SandNotes } from './components/SandNotes';
import { EMPTY, MATERIALS, PALETTE } from './materials';
import { useFallingSand } from './useFallingSand';

const meta = findByPath('/falling-sand')!;

/** 数字键对应的画笔：1 起排，橡皮单独给 E */
const MATERIAL_KEYS = PALETTE.filter(id => id !== EMPTY);

export function FallingSandPage() {
  const {
    containerRef,
    canvasRef,
    config,
    grid,
    running,
    sceneId,
    stats,
    fps,
    patch,
    onResize,
    onPointerDown,
    onPointerMove,
    onPointerUp,
    onPointerLeave,
    selectScene,
    selectMaterial,
    nudgeBrush,
    reset,
    clear,
    step,
    toggleRunning,
  } = useFallingSand();

  useHotkeys([
    {
      key: 'e',
      label: '画笔换成橡皮',
      group: '画笔',
      run: () => selectMaterial(EMPTY),
    },
    ...MATERIAL_KEYS.slice(0, 10).map((id, index) => ({
      // 第十个落到 0 上，键盘上它本来就排在 9 后面
      key: index === 9 ? '0' : String(index + 1),
      label: `画笔换成${MATERIALS[id].name}`,
      group: '画笔',
      run: () => selectMaterial(id),
    })),
    { key: '[', label: '笔刷调小', group: '画笔', run: () => nudgeBrush(-2) },
    { key: ']', label: '笔刷调大', group: '画笔', run: () => nudgeBrush(2) },
    { key: 'c', label: '清空画布', group: '落沙', run: clear },
    {
      key: 'k',
      label: '显示块边框',
      group: '落沙',
      run: () => patch({ showChunks: !config.showChunks }),
    },
    {
      key: 'x',
      label: config.useChunks ? '关掉脏块跳过' : '打开脏块跳过',
      group: '落沙',
      run: () => patch({ useChunks: !config.useChunks }),
    },
    {
      key: 'b',
      label: config.bottomUp ? '改成自顶向下扫' : '改回自底向上扫',
      group: '落沙',
      run: () => patch({ bottomUp: !config.bottomUp }),
    },
    {
      key: 'f',
      label: '水平方向逐帧翻转',
      group: '落沙',
      run: () => patch({ alternateScan: !config.alternateScan }),
    },
  ]);

  return (
    <AlgorithmPage
      meta={meta}
      notes={<SandNotes />}
      playback={{
        running,
        onToggle: toggleRunning,
        onStep: step,
        onReset: reset,
      }}
      controls={
        <SandControls
          config={config}
          sceneId={sceneId}
          onPatch={patch}
          onSceneSelect={selectScene}
          onMaterialSelect={selectMaterial}
        />
      }
    >
      <div className="flex min-h-0 flex-1 flex-col">
        <SandBoard
          containerRef={containerRef}
          canvasRef={canvasRef}
          config={config}
          grid={grid}
          running={running}
          stats={stats}
          fps={fps}
          onResize={onResize}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerLeave={onPointerLeave}
          onToggleRunning={toggleRunning}
          onStep={step}
          onReset={reset}
          onClear={clear}
        />
      </div>
    </AlgorithmPage>
  );
}
