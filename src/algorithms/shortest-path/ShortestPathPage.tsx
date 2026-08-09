import { AlgorithmPage } from '@/components/AlgorithmPage';
import { useHotkeys } from '@/lib/hotkeys';
import { findByPath } from '@/lib/registry';

import { ShortestPathBoard } from './components/ShortestPathBoard';
import { ShortestPathControls } from './components/ShortestPathControls';
import { ShortestPathNotes } from './components/ShortestPathNotes';
import { algorithmLabels } from './constants';
import type { ShortestAlgorithm } from './types';
import { useShortestPath } from './useShortestPath';

const meta = findByPath('/shortest-path')!;

const algorithmKeys: ShortestAlgorithm[] = [
  'dijkstra',
  'bellman-ford',
  'floyd-warshall',
];

export function ShortestPathPage() {
  const {
    config,
    scene,
    source,
    target,
    runId,
    running,
    instant,
    speed,
    stepId,
    endpoint,
    setSpeed,
    setEndpoint,
    tweak,
    selectAlgorithm,
    reshuffle,
    toggleNegativeCycle,
    pickNode,
    swapEndpoints,
    play,
    pause,
    step,
    reset,
    solve,
    handleFinished,
  } = useShortestPath();

  useHotkeys([
    { key: 'f', label: '直接求解', group: '最短路径', run: solve },
    { key: 'g', label: '换一张图', group: '最短路径', run: reshuffle },
    { key: 'e', label: '交换起终点', group: '最短路径', run: swapEndpoints },
    {
      key: 'c',
      label: '注入负环',
      group: '最短路径',
      run: toggleNegativeCycle,
    },
    ...algorithmKeys.map((algorithm, index) => ({
      key: String(index + 1),
      label: `切到 ${algorithmLabels[algorithm].label}`,
      group: '最短路径',
      run: () => selectAlgorithm(algorithm),
    })),
  ]);

  return (
    <AlgorithmPage
      meta={meta}
      notes={<ShortestPathNotes />}
      playback={{
        running,
        onToggle: running ? pause : play,
        onStep: step,
        onReset: reset,
      }}
      controls={
        <ShortestPathControls
          config={config}
          running={running}
          speed={speed}
          endpoint={endpoint}
          onPlay={play}
          onPause={pause}
          onStep={step}
          onReset={reset}
          onSolve={solve}
          onSpeedChange={setSpeed}
          onAlgorithmChange={selectAlgorithm}
          onTweak={tweak}
          onReshuffle={reshuffle}
          onToggleCycle={toggleNegativeCycle}
          onEndpointChange={setEndpoint}
          onSwap={swapEndpoints}
        />
      }
    >
      <div className="flex min-h-0 flex-1 flex-col">
        <ShortestPathBoard
          scene={scene}
          algorithm={config.algorithm}
          source={source}
          target={target}
          runId={runId}
          instant={instant}
          running={running}
          speed={speed}
          stepId={stepId}
          onPick={pickNode}
          onFinished={handleFinished}
        />
      </div>
    </AlgorithmPage>
  );
}
