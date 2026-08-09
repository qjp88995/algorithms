import { AlgorithmPage } from '@/components/AlgorithmPage';
import { useHotkeys } from '@/lib/hotkeys';
import { findByPath } from '@/lib/registry';

import { MaxFlowBoard } from './components/MaxFlowBoard';
import { MaxFlowControls } from './components/MaxFlowControls';
import { MaxFlowNotes } from './components/MaxFlowNotes';
import { algorithmLabels } from './constants';
import type { FlowAlgorithm } from './types';
import { useMaxFlow } from './useMaxFlow';

const meta = findByPath('/max-flow')!;

const algorithmKeys: FlowAlgorithm[] = [
  'ford-fulkerson',
  'edmonds-karp',
  'dinic',
];

export function MaxFlowPage() {
  const {
    config,
    scene,
    runId,
    running,
    instant,
    speed,
    stepId,
    setSpeed,
    tweak,
    selectAlgorithm,
    selectPreset,
    reshuffle,
    toggleCut,
    play,
    pause,
    step,
    reset,
    solve,
    handleFinished,
  } = useMaxFlow();

  useHotkeys([
    { key: 'f', label: '直接求解', group: '最大流', run: solve },
    { key: 'g', label: '换一张图', group: '最大流', run: reshuffle },
    { key: 'c', label: '显示最小割', group: '最大流', run: toggleCut },
    {
      key: 'd',
      label: '钻石图 / 随机网络',
      group: '最大流',
      run: () =>
        selectPreset(config.preset === 'diamond' ? 'random' : 'diamond'),
    },
    ...algorithmKeys.map((algorithm, index) => ({
      key: String(index + 1),
      label: `切到 ${algorithmLabels[algorithm].label}`,
      group: '最大流',
      run: () => selectAlgorithm(algorithm),
    })),
  ]);

  return (
    <AlgorithmPage
      meta={meta}
      notes={<MaxFlowNotes />}
      playback={{
        running,
        onToggle: running ? pause : play,
        onStep: step,
        onReset: reset,
      }}
      controls={
        <MaxFlowControls
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
          onPresetChange={selectPreset}
          onTweak={tweak}
          onReshuffle={reshuffle}
          onToggleCut={toggleCut}
        />
      }
    >
      <div className="flex min-h-0 flex-1 flex-col">
        <MaxFlowBoard
          scene={scene}
          algorithm={config.algorithm}
          showCut={config.showCut}
          runId={runId}
          instant={instant}
          running={running}
          speed={speed}
          stepId={stepId}
          onFinished={handleFinished}
        />
      </div>
    </AlgorithmPage>
  );
}
