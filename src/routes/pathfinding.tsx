import { createFileRoute } from '@tanstack/react-router';

import { PathfindingPage } from '@/algorithms/pathfinding/PathfindingPage';

export const Route = createFileRoute('/pathfinding')({
  component: PathfindingPage,
});
