import { createFileRoute } from '@tanstack/react-router';

import { SpanningTreePage } from '@/algorithms/spanning-tree/SpanningTreePage';

export const Route = createFileRoute('/spanning-tree')({
  component: SpanningTreePage,
});
