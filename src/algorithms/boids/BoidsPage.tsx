import { AlgorithmPage } from '@/components/AlgorithmPage';
import { findByPath } from '@/lib/registry';

import { BoidsDemo } from './components/BoidsDemo';
import { BoidsNotes } from './components/BoidsNotes';

const meta = findByPath('/boids')!;

export function BoidsPage() {
  return (
    <AlgorithmPage meta={meta} notes={<BoidsNotes />}>
      <BoidsDemo />
    </AlgorithmPage>
  );
}
