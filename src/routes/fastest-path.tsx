import { createFileRoute } from '@tanstack/react-router';

import { FastestPathPage } from '@/algorithms/fastest-path/FastestPathPage';

export const Route = createFileRoute('/fastest-path')({
  component: FastestPathPage,
});
