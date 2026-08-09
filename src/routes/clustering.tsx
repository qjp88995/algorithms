import { createFileRoute } from '@tanstack/react-router';

import { ClusteringPage } from '@/algorithms/clustering/ClusteringPage';

export const Route = createFileRoute('/clustering')({
  component: ClusteringPage,
});
