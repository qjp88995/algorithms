import { createFileRoute } from '@tanstack/react-router';

import { FallingSandPage } from '@/algorithms/falling-sand/FallingSandPage';

export const Route = createFileRoute('/falling-sand')({
  component: FallingSandPage,
});
