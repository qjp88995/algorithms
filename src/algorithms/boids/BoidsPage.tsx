import { AlgorithmPage } from '@/components/AlgorithmPage';
import { findByPath } from '@/lib/registry';

import { BoidsCanvas } from './components/BoidsCanvas';
import { BoidsControls } from './components/BoidsControls';
import { BoidsNotes } from './components/BoidsNotes';
import { useBoidsSimulation } from './useBoidsSimulation';

const meta = findByPath('/boids')!;

export function BoidsPage() {
  const { canvasProps, controlsProps } = useBoidsSimulation();

  return (
    <AlgorithmPage
      meta={meta}
      notes={<BoidsNotes />}
      controls={<BoidsControls {...controlsProps} />}
    >
      <BoidsCanvas {...canvasProps} />
    </AlgorithmPage>
  );
}
