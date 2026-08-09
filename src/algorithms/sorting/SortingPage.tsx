import { AlgorithmPage } from '@/components/AlgorithmPage';
import { useHotkeys } from '@/lib/hotkeys';
import { findByPath } from '@/lib/registry';

import { SortingBoard } from './components/SortingBoard';
import { SortingControls } from './components/SortingControls';
import { SortingNotes } from './components/SortingNotes';
import {
  algorithmLabels,
  comparedAlgorithms,
  distributionLabels,
} from './constants';
import type { Distribution } from './data';
import { useSorting } from './useSorting';

const meta = findByPath('/sorting')!;

const distributions = Object.keys(distributionLabels) as Distribution[];

export function SortingPage() {
  const {
    algorithm,
    size,
    distribution,
    seed,
    runId,
    stepId,
    running,
    instant,
    speed,
    compare,
    selectAlgorithm,
    setSpeed,
    setSize,
    setDistribution,
    setCompare,
    reseed,
    play,
    pause,
    step,
    reset,
    solve,
    handleFinished,
  } = useSorting();

  useHotkeys([
    { key: 'f', label: '直接排完', group: '排序', run: solve },
    {
      key: 'c',
      label: '六路对比',
      group: '排序',
      run: () => setCompare(!compare),
    },
    { key: 'g', label: '换批数据', group: '排序', run: reseed },
    {
      key: 'd',
      label: '换数据分布',
      group: '排序',
      run: () => {
        const next = distributions.indexOf(distribution) + 1;
        setDistribution(distributions[next % distributions.length]);
      },
    },
    ...comparedAlgorithms.map((value, index) => ({
      key: String(index + 1),
      label: `切到 ${algorithmLabels[value].label}`,
      group: '排序',
      run: () => {
        if (!compare) selectAlgorithm(value);
      },
    })),
  ]);

  // 画布只吃原始值，不吃对象 —— 少一处"每次渲染都是新引用"的坑
  const shared = {
    size,
    distribution,
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
      notes={<SortingNotes />}
      playback={{
        running,
        onToggle: running ? pause : play,
        onStep: step,
        onReset: reset,
      }}
      controls={
        <SortingControls
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
          size={size}
          onSizeChange={setSize}
          distribution={distribution}
          onDistributionChange={setDistribution}
          seed={seed}
          onReseed={reseed}
          compare={compare}
          onCompareChange={setCompare}
        />
      }
    >
      {compare ? (
        // 六块画布排的是同一批数据 —— 参数一样，生成的数组就逐位相同
        <div className="grid min-h-0 flex-1 grid-cols-1 grid-rows-6 gap-3 lg:grid-cols-3 lg:grid-rows-2">
          {comparedAlgorithms.map(value => (
            <SortingBoard
              key={value}
              {...shared}
              algorithm={value}
              title={algorithmLabels[value].label}
            />
          ))}
        </div>
      ) : (
        <div className="flex min-h-0 flex-1 flex-col">
          <SortingBoard {...shared} algorithm={algorithm} />
        </div>
      )}
    </AlgorithmPage>
  );
}
