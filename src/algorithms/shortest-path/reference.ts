import type { GraphModel } from '@/lib/graph/model';

/**
 * 朴素 Bellman-Ford，一次跑到底。
 *
 * 页面上那个能单步的内核是给人看的，这里这份是给程序看的：
 *   - 生成图时用它确认"没有意外长出负环"；
 *   - 演示时用它当标准答案，把 Dijkstra 在负权下答错的节点标红。
 *
 * 一个演示要能说"这个答案是错的"，就必须手里另有一份对的。
 */
export function exactDistances(
  graph: GraphModel,
  weights: Float64Array,
  source: number
): Float64Array {
  const count = graph.nodes.length;
  const dist = new Float64Array(count).fill(Infinity);
  dist[source] = 0;
  relaxRounds(graph, weights, dist, count - 1);
  return dist;
}

/**
 * 图里是否存在负环（任意位置，不要求从某个起点可达）。
 *
 * 所有节点初始距离设为 0，等价于挂一个虚拟超级源连向每个点：
 * 这样不可达的角落里的负环也逃不掉。
 */
export function hasNegativeCycle(
  graph: GraphModel,
  weights: Float64Array
): boolean {
  const count = graph.nodes.length;
  const dist = new Float64Array(count);
  relaxRounds(graph, weights, dist, count - 1);
  return graph.edges.some(
    (edge, index) => dist[edge.from] + weights[index] < dist[edge.to] - 1e-9
  );
}

function relaxRounds(
  graph: GraphModel,
  weights: Float64Array,
  dist: Float64Array,
  rounds: number
) {
  for (let round = 0; round < rounds; round++) {
    let changed = false;
    graph.edges.forEach((edge, index) => {
      const candidate = dist[edge.from] + weights[index];
      if (candidate < dist[edge.to] - 1e-9) {
        dist[edge.to] = candidate;
        changed = true;
      }
    });
    if (!changed) break;
  }
}
