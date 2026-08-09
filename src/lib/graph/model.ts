/**
 * 平面有向图 —— 「最短路径」和「最快路径」两页共用的地图底座。
 *
 * 只描述**几何与拓扑**，不带任何代价：最短路页往边上挂的是可正可负的
 * 抽象权重，最快路页挂的是随时刻变化的通行时间。两者对"图长什么样"的
 * 要求完全一致，对"边多贵"的定义毫无共同点 —— 所以边权一律由各页自己
 * 用 `Float64Array` 按边下标存，不进这个模型。
 *
 * 每条连线都拆成方向相反的两条有向边，并互相记住对方的下标（`reverse`）。
 * 网格寻路里"邻居"是算出来的，这里必须显式存：边是一等公民，
 * Bellman-Ford 要遍历它、画布要在它身上写权重、用户要点它。
 */

export interface GraphNode {
  /** 归一化坐标，均在 [0, 1] 内；投影到画布由 geometry.ts 负责 */
  x: number;
  y: number;
}

export interface GraphEdge {
  from: number;
  to: number;
  /** 反向边的下标 —— 成对生成，永远存在 */
  reverse: number;
  /** 两端点的欧氏距离，各页据此推导默认权重 / 自由流时间 */
  length: number;
}

export interface GraphModel {
  nodes: GraphNode[];
  edges: GraphEdge[];
  /** outgoing[v] = 以 v 为起点的边下标 */
  outgoing: number[][];
}

/** 节点在界面上的名字：A…Z 之后接 A1、B1…… */
export function nodeName(index: number) {
  const letter = String.fromCharCode(65 + (index % 26));
  const wrap = Math.floor(index / 26);
  return wrap === 0 ? letter : `${letter}${wrap}`;
}

/** 从「无向连线列表」装配出成对的有向边和邻接表 */
export function buildGraph(
  nodes: GraphNode[],
  links: [number, number][]
): GraphModel {
  const edges: GraphEdge[] = [];
  const outgoing: number[][] = nodes.map(() => []);

  for (const [a, b] of links) {
    const length = Math.hypot(nodes[a].x - nodes[b].x, nodes[a].y - nodes[b].y);
    const forward = edges.length;
    const backward = forward + 1;
    edges.push({ from: a, to: b, reverse: backward, length });
    edges.push({ from: b, to: a, reverse: forward, length });
    outgoing[a].push(forward);
    outgoing[b].push(backward);
  }

  return { nodes, edges, outgoing };
}

/**
 * 图上离得最远的一对节点。
 *
 * 两个页面都拿它当默认起终点：挨在一起的两个点之间只有一条路可选，
 * 算法怎么挑都一样，演示就没得看了。
 */
export function farthestPair(graph: GraphModel) {
  let source = 0;
  let target = Math.max(0, graph.nodes.length - 1);
  let best = -1;
  for (let a = 0; a < graph.nodes.length; a++) {
    for (let b = a + 1; b < graph.nodes.length; b++) {
      const dist = Math.hypot(
        graph.nodes[a].x - graph.nodes[b].x,
        graph.nodes[a].y - graph.nodes[b].y
      );
      if (dist > best) {
        best = dist;
        source = a;
        target = b;
      }
    }
  }
  return { source, target };
}

/** 找 from → to 的边下标，没有返回 -1 */
export function findEdge(graph: GraphModel, from: number, to: number) {
  return graph.outgoing[from].find(edge => graph.edges[edge].to === to) ?? -1;
}

/**
 * 从父指针数组回溯出 source → target 的节点序列。
 *
 * `parent[v]` 是最短路树上 v 的前驱节点（不是边），-1 表示不可达。
 * 带环的父指针（负环污染过的表）会让回溯停不下来，所以这里带步数上限。
 */
export function tracePath(parent: Int32Array, source: number, target: number) {
  const path: number[] = [];
  let node = target;
  for (let guard = 0; guard <= parent.length; guard++) {
    path.push(node);
    if (node === source) return path.reverse();
    node = parent[node];
    if (node < 0) return [];
  }
  return [];
}
