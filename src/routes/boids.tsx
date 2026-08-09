import { createFileRoute } from '@tanstack/react-router';

import { BoidsPage } from '@/algorithms/boids/BoidsPage';

export const Route = createFileRoute('/boids')({
  component: BoidsPage,
});
