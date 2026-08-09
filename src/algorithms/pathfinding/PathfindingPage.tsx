import { AlgorithmPage } from '@/components/AlgorithmPage';
import { findByPath } from '@/lib/registry';

import { PathfindingBoard } from './components/PathfindingBoard';
import { PathfindingControls } from './components/PathfindingControls';
import { PathfindingNotes } from './components/PathfindingNotes';
import { algorithmLabels, comparedAlgorithms } from './constants';
import { usePathfinding } from './usePathfinding';

const meta = findByPath('/pathfinding')!;

export function PathfindingPage() {
  const {
    gridRef,
    config,
    runId,
    running,
    instant,
    speed,
    brush,
    compare,
    patchConfig,
    selectAlgorithm,
    setSpeed,
    setBrush,
    setCompare,
    paint,
    play,
    pause,
    reset,
    solve,
    buildMaze,
    buildRandom,
    clearAll,
    handleFinished,
  } = usePathfinding();

  const shared = {
    gridRef,
    runId,
    instant,
    running,
    speed,
    onPaint: paint,
    onFinished: handleFinished,
  };

  return (
    <AlgorithmPage
      meta={meta}
      notes={<PathfindingNotes />}
      controls={
        <PathfindingControls
          config={config}
          onConfigChange={patchConfig}
          onAlgorithmChange={selectAlgorithm}
          running={running}
          onPlay={play}
          onPause={pause}
          onReset={reset}
          onSolve={solve}
          speed={speed}
          onSpeedChange={setSpeed}
          brush={brush}
          onBrushChange={setBrush}
          compare={compare}
          onCompareChange={setCompare}
          onBuildMaze={buildMaze}
          onBuildRandom={buildRandom}
          onClear={clearAll}
        />
      }
    >
      {compare ? (
        // 四块画布共享同一张地图：在任意一块上画墙，四个算法一起重算
        <div className="grid min-h-0 flex-1 grid-cols-1 grid-rows-4 gap-3 lg:grid-cols-2 lg:grid-rows-2">
          {comparedAlgorithms.map(algorithm => (
            <PathfindingBoard
              key={algorithm}
              {...shared}
              config={{ ...config, algorithm }}
              title={algorithmLabels[algorithm].label}
            />
          ))}
        </div>
      ) : (
        <div className="flex min-h-0 flex-1 flex-col">
          <PathfindingBoard {...shared} config={config} />
        </div>
      )}
    </AlgorithmPage>
  );
}
