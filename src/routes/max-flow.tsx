import { createFileRoute } from '@tanstack/react-router';

import { MaxFlowPage } from '@/algorithms/max-flow/MaxFlowPage';

export const Route = createFileRoute('/max-flow')({
  component: MaxFlowPage,
});
