import { DisjointSet } from '@/lib/disjoint-set';
import type { GraphModel } from '@/lib/graph/model';
import { MinHeap } from '@/lib/min-heap';

/**
 * 标准答案与对照量。
 *
 * 页面上那三个能单步的算法是给人看的，这里这些是给程序看的：
 * 判定它们跑完之后总权重对不对，以及算出「最小生成树」和
 * 「最短路树」到底差在哪 —— 这一页要讲的就是这两棵树不是一回事。
 */

/**
 * 无向边的代表下标。
 *
 * `buildGraph` 把每条连线拆成方向相反的两条有向边，成对相邻，
 * 正向那条下标更小。生成树是无向的，全程只用代表下标说话，
 * 免得同一条边被数两遍。
 */
export function linkOf(graph: GraphModel, edge: number) {
  return Math.min(edge, graph.edges[edge].reverse);
}

/** 图上全部无向边，按下标自然顺序 */
export function undirectedLinks(graph: GraphModel): number[] {
  const links: number[] = [];
  graph.edges.forEach((edge, index) => {
    if (index < edge.reverse) links.push(index);
  });
  return links;
}

/**
 * 边的全序：先比权重，权重并列时比边下标。
 *
 * 并列不是小事 —— 权重全都互不相同时最小生成树是唯一的，一旦有并列，
 * 「一棵最小生成树」就可能有好几棵，三个算法各挑各的，画面上看着像
 * 谁算错了（其实总权重分毫不差）。这里给出一个人为的次级比较键，
 * 把它变成全序，三个算法才会给出同一棵树。
 */
export function compareLinks(weights: Float64Array) {
  return (a: number, b: number) => weights[a] - weights[b] || a - b;
}

export interface ReferenceTree {
  /** 树上的边，用代表下标 */
  links: number[];
  weight: number;
}

/** 朴素 Kruskal，一次跑到底 */
export function referenceTree(
  graph: GraphModel,
  weights: Float64Array
): ReferenceTree {
  const links = undirectedLinks(graph).sort(compareLinks(weights));
  const dsu = new DisjointSet(graph.nodes.length);
  const chosen: number[] = [];
  let weight = 0;

  for (const link of links) {
    const { from, to } = graph.edges[link];
    if (!dsu.union(from, to)) continue;
    chosen.push(link);
    weight += weights[link];
  }

  return { links: chosen, weight };
}

/**
 * 从 root 出发的最短路树（Dijkstra）。
 *
 * 注意这是**另一棵**树：它保证根到每个点的路径最短，完全不管
 * 整棵树的总长度。MST 保证的恰恰相反。
 */
export function shortestPathTree(
  graph: GraphModel,
  weights: Float64Array,
  root: number
) {
  const count = graph.nodes.length;
  const dist = new Float64Array(count).fill(Infinity);
  const parentEdge = new Int32Array(count).fill(-1);
  const settled = new Uint8Array(count);
  const heap = new MinHeap();
  let sequence = 0;

  dist[root] = 0;
  heap.push(0, sequence++, root);

  while (heap.size > 0) {
    const node = heap.pop();
    if (settled[node]) continue;
    settled[node] = 1;
    for (const edge of graph.outgoing[node]) {
      const { to } = graph.edges[edge];
      const candidate = dist[node] + weights[edge];
      if (candidate < dist[to] - 1e-9) {
        dist[to] = candidate;
        parentEdge[to] = edge;
        heap.push(candidate, sequence++, to);
      }
    }
  }

  const links: number[] = [];
  let weight = 0;
  for (let node = 0; node < count; node++) {
    if (parentEdge[node] < 0) continue;
    const link = linkOf(graph, parentEdge[node]);
    links.push(link);
    weight += weights[link];
  }

  return { links, dist, weight };
}

/** 沿给定的树（边集）从 root 走到各点的距离；树上不通的为 ∞ */
export function treeDistances(
  graph: GraphModel,
  weights: Float64Array,
  links: number[],
  root: number
): Float64Array {
  const count = graph.nodes.length;
  const dist = new Float64Array(count).fill(Infinity);
  const adjacency: number[][] = Array.from({ length: count }, () => []);
  for (const link of links) {
    const { from, to } = graph.edges[link];
    adjacency[from].push(link);
    adjacency[to].push(link);
  }

  dist[root] = 0;
  const queue = [root];
  for (let head = 0; head < queue.length; head++) {
    const node = queue[head];
    for (const link of adjacency[node]) {
      const { from, to } = graph.edges[link];
      const next = from === node ? to : from;
      if (Number.isFinite(dist[next])) continue;
      dist[next] = dist[node] + weights[link];
      queue.push(next);
    }
  }
  return dist;
}

export interface TreeComparison {
  /** 最短路树的边 */
  links: number[];
  weight: number;
  /** 根到各点的真实最短距离 */
  shortest: Float64Array;
  /** 沿最小生成树走时根到各点的距离 */
  viaTree: Float64Array;
  /** 绕远最厉害的那个点，以及它绕远了几倍 */
  worstNode: number;
  worstRatio: number;
  /** 两棵树的边集差几条 */
  differing: number;
}

/**
 * 把两棵树摆在一起。
 *
 * MST 总权重一定 ≤ 最短路树，但沿 MST 走从根到某个点的距离可以任意糟 ——
 * `worstRatio` 就是这个「任意糟」在当前这张图上具体有多糟。
 */
export function compareTrees(
  graph: GraphModel,
  weights: Float64Array,
  mstLinks: number[],
  root: number
): TreeComparison {
  const tree = shortestPathTree(graph, weights, root);
  const viaTree = treeDistances(graph, weights, mstLinks, root);

  let worstNode = root;
  let worstRatio = 1;
  for (let node = 0; node < graph.nodes.length; node++) {
    if (node === root) continue;
    if (!Number.isFinite(viaTree[node]) || tree.dist[node] <= 0) continue;
    const ratio = viaTree[node] / tree.dist[node];
    if (ratio > worstRatio) {
      worstRatio = ratio;
      worstNode = node;
    }
  }

  const inMst = new Set(mstLinks);
  const differing = tree.links.filter(link => !inMst.has(link)).length;

  return {
    links: tree.links,
    weight: tree.weight,
    shortest: tree.dist,
    viaTree,
    worstNode,
    worstRatio,
    differing,
  };
}
