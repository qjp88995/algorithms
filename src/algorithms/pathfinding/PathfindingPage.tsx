import { useMemo } from 'react';

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

  // 引用必须稳定：画布是靠 config 换了引用才知道"该重建搜索了"
  // （改参数的滑块不递增 runId，只换 config）。每次渲染都新造一遍的话，
  // 最后一块板跑完触发的 running=false 会连带清掉全部四份搜索结果。
  const compareConfigs = useMemo(
    () => comparedAlgorithms.map(algorithm => ({ ...config, algorithm })),
    [config]
  );

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
          {compareConfigs.map(boardConfig => (
            <PathfindingBoard
              key={boardConfig.algorithm}
              {...shared}
              config={boardConfig}
              title={algorithmLabels[boardConfig.algorithm].label}
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
