import { createFileRoute } from '@tanstack/react-router';

import { MazeRunnerPage } from '@/algorithms/maze-runner/MazeRunnerPage';

export const Route = createFileRoute('/maze-runner')({
  component: MazeRunnerPage,
});
