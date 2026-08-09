import { AlgorithmPage } from '@/components/AlgorithmPage';
import { useHotkeys } from '@/lib/hotkeys';
import { findByPath } from '@/lib/registry';

import { ClusteringBoard } from './components/ClusteringBoard';
import { ClusteringControls } from './components/ClusteringControls';
import { ClusteringNotes } from './components/ClusteringNotes';
import { algorithmLabels, datasetLabels } from './constants';
import type { ClusterAlgorithm, DatasetKind } from './types';
import { useClustering } from './useClustering';

const meta = findByPath('/clustering')!;

const algorithmKeys: ClusterAlgorithm[] = ['kmeans', 'dbscan', 'hierarchical'];

const datasetKeys: DatasetKind[] = [
  'blobs',
  'moons',
  'circles',
  'varied',
  'uniform',
];

export function ClusteringPage() {
  const {
    config,
    data,
    showTruth,
    runId,
    running,
    instant,
    speed,
    stepId,
    setSpeed,
    tweak,
    selectAlgorithm,
    selectDataset,
    reshuffle,
    rollInit,
    toggleTruth,
    toggleSmartInit,
    play,
    pause,
    step,
    reset,
    solve,
    handleFinished,
  } = useClustering();

  useHotkeys([
    { key: 'f', label: '直接求解', group: '聚类', run: solve },
    { key: 'g', label: '换一份数据', group: '聚类', run: reshuffle },
    { key: 't', label: '叠加真实分组', group: '聚类', run: toggleTruth },
    { key: 'i', label: '重掷初始中心', group: '聚类', run: rollInit },
    ...algorithmKeys.map((algorithm, index) => ({
      key: String(index + 1),
      label: `切到 ${algorithmLabels[algorithm].label}`,
      group: '聚类',
      run: () => selectAlgorithm(algorithm),
    })),
    ...datasetKeys.map((kind, index) => ({
      key: 'qwert'[index],
      label: `换成${datasetLabels[kind].label}`,
      group: '数据集',
      run: () => selectDataset(kind),
    })),
  ]);

  return (
    <AlgorithmPage
      meta={meta}
      notes={<ClusteringNotes />}
      playback={{
        running,
        onToggle: running ? pause : play,
        onStep: step,
        onReset: reset,
      }}
      controls={
        <ClusteringControls
          config={config}
          showTruth={showTruth}
          running={running}
          speed={speed}
          onPlay={play}
          onPause={pause}
          onStep={step}
          onReset={reset}
          onSolve={solve}
          onSpeedChange={setSpeed}
          onAlgorithmChange={selectAlgorithm}
          onDatasetChange={selectDataset}
          onTweak={tweak}
          onReshuffle={reshuffle}
          onRollInit={rollInit}
          onToggleTruth={toggleTruth}
          onToggleSmartInit={toggleSmartInit}
        />
      }
    >
      <div className="flex min-h-0 flex-1 flex-col">
        <ClusteringBoard
          data={data}
          config={config}
          showTruth={showTruth}
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
