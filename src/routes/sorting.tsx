import { createFileRoute } from '@tanstack/react-router';

import { SortingPage } from '@/algorithms/sorting/SortingPage';

export const Route = createFileRoute('/sorting')({
  component: SortingPage,
});
