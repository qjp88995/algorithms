import { createFileRoute } from '@tanstack/react-router';

import { MazeGenPage } from '@/algorithms/maze-gen/MazeGenPage';

export const Route = createFileRoute('/maze-gen')({
  component: MazeGenPage,
});
