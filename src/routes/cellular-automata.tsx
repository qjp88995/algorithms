import { createFileRoute } from '@tanstack/react-router';

import { CellularAutomataPage } from '@/algorithms/cellular-automata/CellularAutomataPage';

export const Route = createFileRoute('/cellular-automata')({
  component: CellularAutomataPage,
});
