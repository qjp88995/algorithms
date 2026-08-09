import { createFileRoute } from '@tanstack/react-router';

import { ShortestPathPage } from '@/algorithms/shortest-path/ShortestPathPage';

export const Route = createFileRoute('/shortest-path')({
  component: ShortestPathPage,
});
