import { createFileRoute } from '@tanstack/react-router';

import { ParetoPathPage } from '@/algorithms/pareto-path/ParetoPathPage';

export const Route = createFileRoute('/pareto-path')({
  component: ParetoPathPage,
});
