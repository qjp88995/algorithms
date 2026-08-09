import { AlgorithmPage } from '@/components/AlgorithmPage';
import { useHotkeys } from '@/lib/hotkeys';
import { findByPath } from '@/lib/registry';

import { TurnCostBoard } from './components/TurnCostBoard';
import { TurnCostControls } from './components/TurnCostControls';
import { TurnCostNotes } from './components/TurnCostNotes';
import type { Dir } from './types';
import { useTurnCost } from './useTurnCost';

const meta = findByPath('/turn-cost')!;

/** 快捷键调转弯代价用的步长 */
const NUDGE = 0.5;

export function TurnCostPage() {
  const {
    config,
    grid,
    costs,
    stats,
    runId,
    running,
    instant,
    speed,
    stepId,
    showStates,
    setSpeed,
    setShowStates,
    setCost,
    rebuild,
    reshuffle,
    setStartDir,
    pickGoal,
    play,
    pause,
    step,
    reset,
    solve,
    handleFinished,
    handleStats,
  } = useTurnCost();

  useHotkeys([
    { key: 'f', label: '直接求解', group: '转弯代价', run: solve },
    { key: 'g', label: '换一张地图', group: '转弯代价', run: reshuffle },
    {
      key: 'v',
      label: '显示状态空间',
      group: '转弯代价',
      run: () => setShowStates(!showStates),
    },
    {
      key: 'd',
      label: '换出发朝向',
      group: '转弯代价',
      run: () => setStartDir(((config.startDir + 1) % 4) as Dir),
    },
    {
      key: ',',
      label: '转弯便宜一点',
      group: '转弯代价',
      run: () => setCost({ turnCost: Math.max(0, config.turnCost - NUDGE) }),
    },
    {
      key: '.',
      label: '转弯贵一点',
      group: '转弯代价',
      run: () => setCost({ turnCost: Math.min(8, config.turnCost + NUDGE) }),
    },
  ]);

  return (
    <AlgorithmPage
      meta={meta}
      notes={<TurnCostNotes />}
      playback={{
        running,
        onToggle: running ? pause : play,
        onStep: step,
        onReset: reset,
      }}
      controls={
        <TurnCostControls
          config={config}
          stats={stats}
          running={running}
          speed={speed}
          showStates={showStates}
          onPlay={play}
          onPause={pause}
          onStep={step}
          onReset={reset}
          onSolve={solve}
          onSpeedChange={setSpeed}
          onShowStatesChange={setShowStates}
          onCost={setCost}
          onRebuild={rebuild}
          onReshuffle={reshuffle}
          onStartDirChange={setStartDir}
        />
      }
    >
      <TurnCostBoard
        grid={grid}
        costs={costs}
        startDir={config.startDir}
        runId={runId}
        instant={instant}
        running={running}
        speed={speed}
        stepId={stepId}
        showStates={showStates}
        stats={stats}
        onPickGoal={pickGoal}
        onFinished={handleFinished}
        onStats={handleStats}
      />
    </AlgorithmPage>
  );
}
