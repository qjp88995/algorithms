import { createFileRoute } from '@tanstack/react-router';

import { TurnCostPage } from '@/algorithms/turn-cost/TurnCostPage';

export const Route = createFileRoute('/turn-cost')({
  component: TurnCostPage,
});
