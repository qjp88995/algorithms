import { AlgorithmPage } from '@/components/AlgorithmPage';
import { useHotkeys } from '@/lib/hotkeys';
import { findByPath } from '@/lib/registry';

import { MazeGenBoard } from './components/MazeGenBoard';
import { MazeGenControls } from './components/MazeGenControls';
import { MazeGenNotes } from './components/MazeGenNotes';
import { algorithmLabels, comparedAlgorithms } from './constants';
import { useMazeGen } from './useMazeGen';

const meta = findByPath('/maze-gen')!;

export function MazeGenPage() {
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
    selectAlgorithm,
    setSpeed,
    setCols,
    setCompare,
    reseed,
    play,
    pause,
    step,
    reset,
    solve,
    handleFinished,
  } = useMazeGen();

  useHotkeys([
    { key: 'f', label: '直接生成', group: '迷宫生成', run: solve },
    {
      key: 'c',
      label: '四路对比',
      group: '迷宫生成',
      run: () => setCompare(!compare),
    },
    { key: 'g', label: '换个种子', group: '迷宫生成', run: reseed },
    ...comparedAlgorithms.map((value, index) => ({
      key: String(index + 1),
      label: `切到 ${algorithmLabels[value].label}`,
      group: '迷宫生成',
      run: () => {
        if (!compare) selectAlgorithm(value);
      },
    })),
  ]);

  // 画布只吃原始值，不吃对象 —— 少一处"每次渲染都是新引用"的坑
  const shared = {
    cols,
    rows,
    seed,
    runId,
    instant,
    running,
    speed,
    stepId,
    onFinished: handleFinished,
  };

  return (
    <AlgorithmPage
      meta={meta}
      notes={<MazeGenNotes />}
      playback={{
        running,
        onToggle: running ? pause : play,
        onStep: step,
        onReset: reset,
      }}
      controls={
        <MazeGenControls
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
        />
      }
    >
      {compare ? (
        // 四块画布各长各的迷宫，但共用一个种子 —— 比的是长法不是运气
        <div className="grid min-h-0 flex-1 grid-cols-1 grid-rows-4 gap-3 lg:grid-cols-2 lg:grid-rows-2">
          {comparedAlgorithms.map(value => (
            <MazeGenBoard
              key={value}
              {...shared}
              algorithm={value}
              title={algorithmLabels[value].label}
            />
          ))}
        </div>
      ) : (
        <div className="flex min-h-0 flex-1 flex-col">
          <MazeGenBoard {...shared} algorithm={algorithm} />
        </div>
      )}
    </AlgorithmPage>
  );
}
