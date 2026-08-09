import { generateGeometricGraph } from '@/lib/graph/generate';
import {
  buildGraph,
  farthestPair,
  type GraphModel,
  type GraphNode,
} from '@/lib/graph/model';
import { seededRandom } from '@/lib/random';

import { DIAMOND_CAPACITY, MAX_CAPACITY, MIN_CAPACITY } from './constants';
import { referenceMaxFlow } from './reference';
import type { FlowConfig, FlowPreset } from './types';

/**
 * 一张有向容量网络，构成演示的一「局」。
 *
 * 底图仍然是 `lib/graph/` 那张平面图 —— 它把每条连线拆成方向相反的
 * 两条有向边并互相记住对方。这个结构正好就是**残量网络**要的形状：
 * 正向边挂容量，反向边容量为零，推流时两边一增一减。所以这一页
 * 不需要额外的数据结构，只需要给边配一组容量。
 */
export interface FlowScene {
  graph: GraphModel;
  /** 按有向边下标存的容量；反向边一律为 0 */
  capacity: Float64Array;
  source: number;
  sink: number;
  /** 这张网络的标准答案 */
  maxFlow: number;
  preset: FlowPreset;
}

export function buildScene(config: FlowConfig): FlowScene {
  const scene =
    config.preset === 'diamond' ? diamondNetwork() : randomNetwork(config);
  return {
    ...scene,
    maxFlow: referenceMaxFlow(
      scene.graph,
      scene.capacity,
      scene.source,
      scene.sink
    ),
  };
}

function randomNetwork(config: FlowConfig): Omit<FlowScene, 'maxFlow'> {
  const graph = generateGeometricGraph({
    nodeCount: config.nodeCount,
    degree: config.degree,
    seed: config.seed,
  });
  const { source, target: sink } = farthestPair(graph);
  const capacity = orient(graph, source, seededRandom(config.seed * 131 + 7));
  return { graph, capacity, source, sink, preset: 'random' };
}

/**
 * 给每条连线定向：从离源点近的一端指向远的一端。
 *
 * 无向的平面图直接拿来当流网络会很难读 —— 流可以在两个方向上乱窜，
 * 画面上看不出"往下游走"这件事。按层次定向之后网络无环，流从左边
 * 一路推到右边，瓶颈在哪一眼就能找到。同一层的两个点按下标定向，
 * 这样也长不出环来。
 */
function orient(
  graph: GraphModel,
  source: number,
  random: () => number
): Float64Array {
  const level = levels(graph, source);
  const capacity = new Float64Array(graph.edges.length);

  graph.edges.forEach((edge, index) => {
    // 一条连线只定一次向，反向那条留 0 容量给残量用
    if (index > edge.reverse) return;
    const forward = level[edge.from] <= level[edge.to] ? index : edge.reverse;
    capacity[forward] =
      MIN_CAPACITY + Math.floor(random() * (MAX_CAPACITY - MIN_CAPACITY + 1));
  });

  return capacity;
}

/** 无向意义下从 source 出发的 BFS 层次 */
function levels(graph: GraphModel, source: number): Int32Array {
  const level = new Int32Array(graph.nodes.length).fill(-1);
  level[source] = 0;
  const queue = [source];
  for (let head = 0; head < queue.length; head++) {
    const node = queue[head];
    for (const edge of graph.outgoing[node]) {
      const { to } = graph.edges[edge];
      if (level[to] >= 0) continue;
      level[to] = level[node] + 1;
      queue.push(to);
    }
  }
  return level;
}

/**
 * 教科书里的钻石图。
 *
 *        a
 *      ↗   ↘
 *   s    ↓1   t        s→a、s→b、a→t、b→t 都很宽，中间 a→b 只有 1
 *      ↘   ↗
 *        b
 *
 * 深度优先会先一头扎进 s→a→b→t，只推得动 1；
 * 之后还得靠反向边把这 1 退回去才能凑够最大流。广度优先根本不会去碰
 * 中间那条边 —— 两条最短路一走，两轮结束。
 *
 * 连线的顺序是刻意的：`a` 的出边表里 a→b 排在 a→t 前面，深度优先
 * 才会先去试那条窄路。演示里"先撞见哪条"不是随机的，是邻接表的顺序。
 */
function diamondNetwork(): Omit<FlowScene, 'maxFlow'> {
  const nodes: GraphNode[] = [
    { x: 0, y: 0.5 },
    { x: 0.5, y: 0 },
    { x: 0.5, y: 1 },
    { x: 1, y: 0.5 },
  ];
  const graph = buildGraph(nodes, [
    [0, 1],
    [0, 2],
    [1, 2],
    [1, 3],
    [2, 3],
  ]);

  const capacity = new Float64Array(graph.edges.length);
  capacity[0] = DIAMOND_CAPACITY; // s → a
  capacity[2] = DIAMOND_CAPACITY; // s → b
  capacity[4] = 1; // a → b，瓶颈
  capacity[6] = DIAMOND_CAPACITY; // a → t
  capacity[8] = DIAMOND_CAPACITY; // b → t

  return { graph, capacity, source: 0, sink: 3, preset: 'diamond' };
}
