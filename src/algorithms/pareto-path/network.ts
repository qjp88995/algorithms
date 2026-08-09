import { generateGeometricGraph } from '@/lib/graph/generate';
import { farthestPair, type GraphModel, tracePath } from '@/lib/graph/model';
import { MinHeap } from '@/lib/min-heap';
import { seededRandom } from '@/lib/random';

import type { ParetoConfig } from './types';

/**
 * 一条路的两个代价。正反两向共享同一份数值 —— 这是条双向的路。
 *
 * 两者刻意做成负相关：等级高的是收费快速路，又快又贵；等级低的是国道，
 * 慢但免费。如果时间和收费同向变化，贵的路同时也更慢，那它会被直接支配掉，
 * 前沿上只剩一个解 —— 这一页就没什么可看的了。
 */
export interface TollEdge {
  /** 通行时间（分钟） */
  time: number;
  /** 过路费（元） */
  toll: number;
  /** 道路等级 0…1：越高越快、也越贵 */
  grade: number;
}

export interface TollNetwork {
  graph: GraphModel;
  edges: TollEdge[];
  source: number;
  target: number;
}

export function buildNetwork(config: ParetoConfig): TollNetwork {
  const graph = generateGeometricGraph({
    nodeCount: config.nodeCount,
    degree: config.degree,
    seed: config.seed,
  });

  const random = seededRandom(config.seed * 74209 + 13);
  const edges: TollEdge[] = graph.edges.map(() => ({
    time: 0,
    toll: 0,
    grade: 0,
  }));

  graph.edges.forEach((edge, index) => {
    if (index > edge.reverse) {
      edges[index] = { ...edges[edge.reverse] };
      return;
    }
    const grade = random();
    const base = edge.length * 60 + 6;
    edges[index] = {
      grade,
      // 取整不只是为了好读：整数代价下前沿上的点不会被浮点误差挤出凸包，
      // 「这个解在角上还是在凹处」才是个稳定的判断
      time: Math.max(3, Math.round(base * (1.45 - 0.75 * grade))),
      toll: Math.round(base * grade * grade * config.spread * 0.9),
    };
  });

  const { source, target } = farthestPair(graph);
  return { graph, edges, source, target };
}

/** 把两个代价按偏好压成一个数 —— 标量化，也就是「加权和」那条老路 */
export function scalarCost(edge: TollEdge, lambda: number) {
  return lambda * edge.time + (1 - lambda) * edge.toll;
}

/**
 * 加权和 Dijkstra：把双目标压成单目标之后的答案。
 *
 * UI 不用它 —— 前沿已经算出来了，直接在前沿里取加权和最小的点即可。
 * 但它是这一页那句话的独立证据：扫遍所有 λ，它能拿到的解恰好是凸包角点，
 * 凹处的解一个都碰不到。测试就是这么验的。
 */
export function weightedRoute(
  network: TollNetwork,
  lambda: number,
  source: number,
  target: number
): { path: number[]; time: number; toll: number } | null {
  const count = network.graph.nodes.length;
  const dist = new Float64Array(count).fill(Infinity);
  const parent = new Int32Array(count).fill(-1);
  const settled = new Uint8Array(count);
  const heap = new MinHeap();
  let sequence = 0;

  dist[source] = 0;
  heap.push(0, sequence++, source);

  while (heap.size > 0) {
    const node = heap.pop();
    if (settled[node]) continue;
    settled[node] = 1;
    for (const edge of network.graph.outgoing[node]) {
      const next = network.graph.edges[edge].to;
      const candidate = dist[node] + scalarCost(network.edges[edge], lambda);
      if (candidate < dist[next] - 1e-9) {
        dist[next] = candidate;
        parent[next] = node;
        heap.push(candidate, sequence++, next);
      }
    }
  }

  const path = tracePath(parent, source, target);
  if (path.length < 2) return null;
  return { path, ...costOf(network, path) };
}

/** 沿一条给定路线累加两个代价 */
export function costOf(network: TollNetwork, path: number[]) {
  let time = 0;
  let toll = 0;
  for (let i = 1; i < path.length; i++) {
    const edge = network.graph.outgoing[path[i - 1]].find(
      candidate => network.graph.edges[candidate].to === path[i]
    );
    if (edge === undefined) break;
    time += network.edges[edge].time;
    toll += network.edges[edge].toll;
  }
  return { time, toll };
}
