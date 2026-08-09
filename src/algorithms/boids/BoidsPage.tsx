import { AlgorithmPage } from '@/components/AlgorithmPage';
import { useHotkeys } from '@/lib/hotkeys';
import { findByPath } from '@/lib/registry';

import { BoidsCanvas } from './components/BoidsCanvas';
import { BoidsControls } from './components/BoidsControls';
import { BoidsNotes } from './components/BoidsNotes';
import { useBoidsSimulation } from './useBoidsSimulation';

const meta = findByPath('/boids')!;

export function BoidsPage() {
  const { canvasProps, controlsProps } = useBoidsSimulation();

  useHotkeys([
    {
      key: 't',
      label: '拖尾',
      group: '群鸟',
      run: () => controlsProps.onTrailsChange(!controlsProps.trails),
    },
    {
      key: 'b',
      label: '按朝向着色',
      group: '群鸟',
      run: () =>
        controlsProps.onColorByHeadingChange(!controlsProps.colorByHeading),
    },
  ]);

  return (
    <AlgorithmPage
      meta={meta}
      notes={<BoidsNotes />}
      controls={<BoidsControls {...controlsProps} />}
      playback={{
        running: canvasProps.running,
        onToggle: canvasProps.onToggleRunning,
        onStep: canvasProps.onStepOnce,
        onReset: canvasProps.onReset,
      }}
    >
      <BoidsCanvas {...canvasProps} />
    </AlgorithmPage>
  );
}
