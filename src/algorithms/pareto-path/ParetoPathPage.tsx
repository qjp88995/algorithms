import { AlgorithmPage } from '@/components/AlgorithmPage';
import { useHotkeys } from '@/lib/hotkeys';
import { findByPath } from '@/lib/registry';

import { CostSpace } from './components/CostSpace';
import { ParetoPathBoard } from './components/ParetoPathBoard';
import { ParetoPathControls } from './components/ParetoPathControls';
import { ParetoPathNotes } from './components/ParetoPathNotes';
import { useParetoPath } from './useParetoPath';

const meta = findByPath('/pareto-path')!;

/** 快捷键调偏好用的步长 */
const NUDGE = 0.05;

export function ParetoPathPage() {
  const {
    config,
    network,
    source,
    target,
    solutions,
    samples,
    selected,
    best,
    runId,
    running,
    instant,
    speed,
    stepId,
    endpoint,
    setSpeed,
    setEndpoint,
    setLambda,
    tweak,
    reshuffle,
    pickNode,
    swapEndpoints,
    select,
    browse,
    play,
    pause,
    step,
    reset,
    solve,
    handleFinished,
    handleSolved,
  } = useParetoPath();

  useHotkeys([
    { key: 'f', label: '直接求解', group: '帕累托权衡', run: solve },
    { key: 'g', label: '换一张路网', group: '帕累托权衡', run: reshuffle },
    { key: 'e', label: '交换起终点', group: '帕累托权衡', run: swapEndpoints },
    {
      key: '[',
      label: '选前一个解',
      group: '帕累托权衡',
      run: () => browse(-1),
    },
    {
      key: ']',
      label: '选后一个解',
      group: '帕累托权衡',
      run: () => browse(1),
    },
    {
      key: ',',
      label: '偏好偏向省钱',
      group: '帕累托权衡',
      run: () => setLambda(Math.max(0, config.lambda - NUDGE)),
    },
    {
      key: '.',
      label: '偏好偏向省时间',
      group: '帕累托权衡',
      run: () => setLambda(Math.min(1, config.lambda + NUDGE)),
    },
  ]);

  return (
    <AlgorithmPage
      meta={meta}
      notes={<ParetoPathNotes />}
      playback={{
        running,
        onToggle: running ? pause : play,
        onStep: step,
        onReset: reset,
      }}
      controls={
        <ParetoPathControls
          config={config}
          running={running}
          speed={speed}
          endpoint={endpoint}
          solutions={solutions}
          selected={selected}
          best={best}
          onPlay={play}
          onPause={pause}
          onStep={step}
          onReset={reset}
          onSolve={solve}
          onSpeedChange={setSpeed}
          onLambdaChange={setLambda}
          onTweak={tweak}
          onReshuffle={reshuffle}
          onSelect={select}
          onEndpointChange={setEndpoint}
          onSwap={swapEndpoints}
        />
      }
    >
      <div className="flex min-h-0 flex-1 flex-col">
        <ParetoPathBoard
          network={network}
          source={source}
          target={target}
          runId={runId}
          instant={instant}
          running={running}
          speed={speed}
          stepId={stepId}
          selected={selected}
          onPick={pickNode}
          onFinished={handleFinished}
          onSolved={handleSolved}
        />
        <CostSpace
          samples={samples}
          solutions={solutions}
          selected={selected}
          best={best}
          lambda={config.lambda}
          onSelect={select}
        />
      </div>
    </AlgorithmPage>
  );
}
