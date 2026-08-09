import { AlgorithmPage } from '@/components/AlgorithmPage';
import { useHotkeys } from '@/lib/hotkeys';
import { findByPath } from '@/lib/registry';

import { MazeRunnerBoard } from './components/MazeRunnerBoard';
import { MazeRunnerControls } from './components/MazeRunnerControls';
import { MazeRunnerNotes } from './components/MazeRunnerNotes';
import { algorithmLabels, comparedAlgorithms } from './constants';
import { useMazeRunner } from './useMazeRunner';

const meta = findByPath('/maze-runner')!;

export function MazeRunnerPage() {
  const {
    algorithm,
    cols,
    rows,
    seed,
    runId,
    stepId,
    running,
    instant,
    speed,
    compare,
    fog,
    selectAlgorithm,
    setSpeed,
    setCols,
    setCompare,
    setFog,
    reseed,
    play,
    pause,
    step,
    reset,
    solve,
    handleFinished,
  } = useMazeRunner();

  useHotkeys([
    { key: 'f', label: '一路走完', group: '走迷宫', run: solve },
    {
      key: 'c',
      label: '四路对比',
      group: '走迷宫',
      run: () => setCompare(!compare),
    },
    {
      key: 'v',
      label: '迷雾开关',
      group: '走迷宫',
      run: () => setFog(!fog),
    },
    { key: 'g', label: '换张迷宫', group: '走迷宫', run: reseed },
    ...comparedAlgorithms.map((value, index) => ({
      key: String(index + 1),
      label: `切到 ${algorithmLabels[value].label}`,
      group: '走迷宫',
      run: () => {
        if (!compare) selectAlgorithm(value);
      },
    })),
  ]);

  const shared = {
    cols,
    rows,
    seed,
    runId,
    instant,
    running,
    speed,
    stepId,
    fog,
    onFinished: handleFinished,
  };

  return (
    <AlgorithmPage
      meta={meta}
      notes={<MazeRunnerNotes />}
      playback={{
        running,
        onToggle: running ? pause : play,
        onStep: step,
        onReset: reset,
      }}
      controls={
        <MazeRunnerControls
          algorithm={algorithm}
          onAlgorithmChange={selectAlgorithm}
          running={running}
          onPlay={play}
          onPause={pause}
          onStep={step}
          onReset={reset}
          onSolve={solve}
          speed={speed}
          onSpeedChange={setSpeed}
          cols={cols}
          rows={rows}
          onColsChange={setCols}
          seed={seed}
          onReseed={reseed}
          compare={compare}
          onCompareChange={setCompare}
          fog={fog}
          onFogChange={setFog}
        />
      }
    >
      {compare ? (
        // 四块画布走的是同一张迷宫，比的才是走法本身
        <div className="grid min-h-0 flex-1 grid-cols-1 grid-rows-4 gap-3 lg:grid-cols-2 lg:grid-rows-2">
          {comparedAlgorithms.map(value => (
            <MazeRunnerBoard
              key={value}
              {...shared}
              algorithm={value}
              title={algorithmLabels[value].label}
            />
          ))}
        </div>
      ) : (
        <div className="flex min-h-0 flex-1 flex-col">
          <MazeRunnerBoard {...shared} algorithm={algorithm} />
        </div>
      )}
    </AlgorithmPage>
  );
}
