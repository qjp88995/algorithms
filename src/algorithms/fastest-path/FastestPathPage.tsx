import { AlgorithmPage } from '@/components/AlgorithmPage';
import { useHotkeys } from '@/lib/hotkeys';
import { findByPath } from '@/lib/registry';

import { ArrivalProfile } from './components/ArrivalProfile';
import { FastestPathBoard } from './components/FastestPathBoard';
import { FastestPathControls } from './components/FastestPathControls';
import { FastestPathNotes } from './components/FastestPathNotes';
import { DAY } from './constants';
import { useFastestPath } from './useFastestPath';

const meta = findByPath('/fastest-path')!;

/** 快捷键调出发时刻用的步长：一刻钟 */
const NUDGE = 15;

export function FastestPathPage() {
  const {
    config,
    network,
    source,
    target,
    profile,
    runId,
    running,
    instant,
    speed,
    stepId,
    endpoint,
    setSpeed,
    setEndpoint,
    setDeparture,
    tweak,
    reshuffle,
    toggleRoadwork,
    toggleWaiting,
    pickNode,
    swapEndpoints,
    play,
    pause,
    step,
    reset,
    solve,
    handleFinished,
  } = useFastestPath();

  useHotkeys([
    { key: 'f', label: '直接求解', group: '最快路径', run: solve },
    { key: 'g', label: '换一张路网', group: '最快路径', run: reshuffle },
    { key: 'e', label: '交换起终点', group: '最快路径', run: swapEndpoints },
    { key: 'c', label: '施工封路', group: '最快路径', run: toggleRoadwork },
    { key: 'w', label: '允许等待', group: '最快路径', run: toggleWaiting },
    {
      key: ',',
      label: '出发时刻早一刻钟',
      group: '最快路径',
      run: () => setDeparture((config.departure - NUDGE + DAY) % DAY),
    },
    {
      key: '.',
      label: '出发时刻晚一刻钟',
      group: '最快路径',
      run: () => setDeparture((config.departure + NUDGE) % DAY),
    },
  ]);

  return (
    <AlgorithmPage
      meta={meta}
      notes={<FastestPathNotes />}
      playback={{
        running,
        onToggle: running ? pause : play,
        onStep: step,
        onReset: reset,
      }}
      controls={
        <FastestPathControls
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
          onDepartureChange={setDeparture}
          onTweak={tweak}
          onReshuffle={reshuffle}
          onToggleRoadwork={toggleRoadwork}
          onToggleWaiting={toggleWaiting}
          onEndpointChange={setEndpoint}
          onSwap={swapEndpoints}
        />
      }
    >
      <div className="flex min-h-0 flex-1 flex-col">
        <FastestPathBoard
          network={network}
          source={source}
          target={target}
          departure={config.departure}
          runId={runId}
          instant={instant}
          running={running}
          speed={speed}
          stepId={stepId}
          onPick={pickNode}
          onFinished={handleFinished}
        />
        <ArrivalProfile samples={profile} departure={config.departure} />
      </div>
    </AlgorithmPage>
  );
}
