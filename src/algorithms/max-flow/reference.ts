import type { GraphModel } from '@/lib/graph/model';

/**
 * 标准答案与最小割。
 *
 * 页面上那三个能单步的算法是给人看的，这里这份是给程序看的：
 * 判定它们跑完之后的流量对不对，以及把「最大流 = 最小割」这句话
 * 变成画布上真能圈出来的一组边。
 */

export const FLOW_EPS = 1e-9;

/** 残量：这条边还能再推多少。反向边的残量就是正向已经推过的流 */
export function residual(
  capacity: Float64Array,
  flow: Float64Array,
  edge: number
) {
  return capacity[edge] - flow[edge];
}

/** 朴素 Edmonds-Karp，一次跑到底 */
export function referenceMaxFlow(
  graph: GraphModel,
  capacity: Float64Array,
  source: number,
  sink: number
): number {
  const flow = new Float64Array(graph.edges.length);
  const parentEdge = new Int32Array(graph.nodes.length);
  let total = 0;

  for (;;) {
    parentEdge.fill(-1);
    const seen = new Uint8Array(graph.nodes.length);
    seen[source] = 1;
    const queue = [source];
    for (let head = 0; head < queue.length && !seen[sink]; head++) {
      for (const edge of graph.outgoing[queue[head]]) {
        const { to } = graph.edges[edge];
        if (seen[to] || residual(capacity, flow, edge) <= FLOW_EPS) continue;
        seen[to] = 1;
        parentEdge[to] = edge;
        queue.push(to);
      }
    }
    if (!seen[sink]) return total;

    let bottleneck = Infinity;
    for (let node = sink; node !== source;) {
      const edge = parentEdge[node];
      bottleneck = Math.min(bottleneck, residual(capacity, flow, edge));
      node = graph.edges[edge].from;
    }
    for (let node = sink; node !== source;) {
      const edge = parentEdge[node];
      flow[edge] += bottleneck;
      flow[graph.edges[edge].reverse] -= bottleneck;
      node = graph.edges[edge].from;
    }
    total += bottleneck;
  }
}

/**
 * 源点一侧的点集：在**残量网络**里还能从源点走到的地方。
 *
 * 流跑到最大之后，这个集合和它的补集之间那道口子上的边全都饱和了 ——
 * 这正是最小割。所以割不需要另外去找，它是最大流的副产品。
 */
export function sourceSide(
  graph: GraphModel,
  capacity: Float64Array,
  flow: Float64Array,
  source: number
): Uint8Array {
  const side = new Uint8Array(graph.nodes.length);
  side[source] = 1;
  const queue = [source];
  for (let head = 0; head < queue.length; head++) {
    for (const edge of graph.outgoing[queue[head]]) {
      const { to } = graph.edges[edge];
      if (side[to] || residual(capacity, flow, edge) <= FLOW_EPS) continue;
      side[to] = 1;
      queue.push(to);
    }
  }
  return side;
}

/** 横跨割口、方向朝外的那些边（原图上真实存在的边，容量大于零） */
export function cutEdges(
  graph: GraphModel,
  capacity: Float64Array,
  side: Uint8Array
): number[] {
  const edges: number[] = [];
  graph.edges.forEach((edge, index) => {
    if (capacity[index] <= 0) return;
    if (side[edge.from] === 1 && side[edge.to] === 0) edges.push(index);
  });
  return edges;
}

export function cutCapacity(capacity: Float64Array, edges: number[]) {
  return edges.reduce((sum, edge) => sum + capacity[edge], 0);
}
