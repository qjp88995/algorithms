import { AlgorithmPage } from '@/components/AlgorithmPage';
import { useHotkeys } from '@/lib/hotkeys';
import { findByPath } from '@/lib/registry';

import { SpanningTreeBoard } from './components/SpanningTreeBoard';
import { SpanningTreeControls } from './components/SpanningTreeControls';
import { SpanningTreeNotes } from './components/SpanningTreeNotes';
import { algorithmLabels } from './constants';
import type { SpanningAlgorithm } from './types';
import { useSpanningTree } from './useSpanningTree';

const meta = findByPath('/spanning-tree')!;

const algorithmKeys: SpanningAlgorithm[] = ['kruskal', 'prim', 'boruvka'];

export function SpanningTreePage() {
  const {
    config,
    scene,
    root,
    comparison,
    runId,
    running,
    instant,
    speed,
    stepId,
    setSpeed,
    tweak,
    selectAlgorithm,
    reshuffle,
    toggleCompare,
    pickRoot,
    play,
    pause,
    step,
    reset,
    solve,
    handleFinished,
  } = useSpanningTree();

  useHotkeys([
    { key: 'f', label: '直接求解', group: '最小生成树', run: solve },
    { key: 'g', label: '换一张图', group: '最小生成树', run: reshuffle },
    {
      key: 't',
      label: '叠加最短路树',
      group: '最小生成树',
      run: toggleCompare,
    },
    ...algorithmKeys.map((algorithm, index) => ({
      key: String(index + 1),
      label: `切到 ${algorithmLabels[algorithm].label}`,
      group: '最小生成树',
      run: () => selectAlgorithm(algorithm),
    })),
  ]);

  return (
    <AlgorithmPage
      meta={meta}
      notes={<SpanningTreeNotes />}
      playback={{
        running,
        onToggle: running ? pause : play,
        onStep: step,
        onReset: reset,
      }}
      controls={
        <SpanningTreeControls
          config={config}
          running={running}
          speed={speed}
          onPlay={play}
          onPause={pause}
          onStep={step}
          onReset={reset}
          onSolve={solve}
          onSpeedChange={setSpeed}
          onAlgorithmChange={selectAlgorithm}
          onTweak={tweak}
          onReshuffle={reshuffle}
          onToggleCompare={toggleCompare}
        />
      }
    >
      <div className="flex min-h-0 flex-1 flex-col">
        <SpanningTreeBoard
          scene={scene}
          algorithm={config.algorithm}
          root={root}
          comparison={comparison}
          runId={runId}
          instant={instant}
          running={running}
          speed={speed}
          stepId={stepId}
          onPick={pickRoot}
          onFinished={handleFinished}
        />
      </div>
    </AlgorithmPage>
  );
}
