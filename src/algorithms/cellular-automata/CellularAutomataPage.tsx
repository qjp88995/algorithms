import { AlgorithmPage } from '@/components/AlgorithmPage';
import { useHotkeys } from '@/lib/hotkeys';
import { findByPath } from '@/lib/registry';

import { CellularBoard } from './components/CellularBoard';
import { CellularControls } from './components/CellularControls';
import { CellularNotes } from './components/CellularNotes';
import { elementaryPresets, rulePresets } from './constants';
import { parseRule } from './life';
import { useCellularAutomata } from './useCellularAutomata';

const meta = findByPath('/cellular-automata')!;

export function CellularAutomataPage() {
  const {
    containerRef,
    canvasRef,
    config,
    dims,
    running,
    stats,
    elementaryStats,
    fps,
    patternId,
    patch,
    onResize,
    onPointerDown,
    onPointerMove,
    onPointerUp,
    onPointerLeave,
    clear,
    randomize,
    reseed,
    reset,
    step,
    toggleRunning,
    selectRule,
    selectRuleNumber,
    selectDimension,
    selectSeed,
    selectPattern,
  } = useCellularAutomata();

  const is2d = config.dimension === '2d';

  useHotkeys([
    {
      key: 'd',
      label: is2d ? '切到一维' : '切到二维',
      group: '元胞自动机',
      run: () => selectDimension(is2d ? '1d' : '2d'),
    },
    {
      key: 'g',
      label: is2d ? '随机撒点' : '重新播种',
      group: '元胞自动机',
      run: is2d ? randomize : reseed,
    },
    {
      key: 'l',
      label: '网格线',
      group: '元胞自动机',
      run: () => patch({ showGrid: !config.showGrid }),
    },
    ...(is2d
      ? [
          { key: 'c', label: '清空画布', group: '元胞自动机', run: clear },
          {
            key: 'a',
            label: '按年龄着色',
            group: '元胞自动机',
            run: () => patch({ ageColoring: !config.ageColoring }),
          },
          {
            key: 'b',
            label: '环形 / 有界边界',
            group: '元胞自动机',
            run: () =>
              patch({ edge: config.edge === 'torus' ? 'bounded' : 'torus' }),
          },
          ...rulePresets.map((preset, index) => ({
            key: String(index + 1),
            label: `切到 ${preset.label}（${preset.notation}）`,
            group: '规则',
            run: () => selectRule(parseRule(preset.notation)),
          })),
        ]
      : elementaryPresets.map((preset, index) => ({
          key: String(index + 1),
          label: `切到 ${preset.label}`,
          group: '规则',
          run: () => selectRuleNumber(preset.rule),
        }))),
  ]);

  return (
    <AlgorithmPage
      meta={meta}
      notes={<CellularNotes />}
      playback={{
        running,
        onToggle: toggleRunning,
        onStep: step,
        onReset: reset,
      }}
      controls={
        <CellularControls
          config={config}
          patternId={patternId}
          onPatch={patch}
          onRuleChange={selectRule}
          onRuleNumberChange={selectRuleNumber}
          onDimensionChange={selectDimension}
          onSeedChange={selectSeed}
          onPatternSelect={selectPattern}
        />
      }
    >
      <div className="flex min-h-0 flex-1 flex-col">
        <CellularBoard
          containerRef={containerRef}
          canvasRef={canvasRef}
          config={config}
          dims={dims}
          running={running}
          stats={stats}
          elementaryStats={elementaryStats}
          fps={fps}
          patternId={patternId}
          onResize={onResize}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerLeave={onPointerLeave}
          onToggleRunning={toggleRunning}
          onStep={step}
          onReset={reset}
          onClear={clear}
          onRandomize={randomize}
          onReseed={reseed}
        />
      </div>
    </AlgorithmPage>
  );
}
