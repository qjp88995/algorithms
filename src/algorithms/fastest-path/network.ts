import { generateGeometricGraph } from '@/lib/graph/generate';
import { farthestPair, type GraphModel, tracePath } from '@/lib/graph/model';
import { MinHeap } from '@/lib/min-heap';
import { seededRandom } from '@/lib/random';

import {
  DAY,
  EVENING_PEAK,
  EVENING_WIDTH,
  MORNING_PEAK,
  MORNING_WIDTH,
  PROFILE_STEP,
  ROADWORK_OPEN_AT,
  ROADWORK_PENALTY,
} from './constants';
import type { FastestConfig, ProfileSample } from './types';

/** 一条路的静态属性。正反两向共享同一份数值 —— 这是条双向的路 */
export interface RoadEdge {
  /** 自由流通行时间（分钟）：空路上跑完要多久 */
  free: number;
  /** 对高峰的敏感度 0…1。小路会堵死，快速路几乎不受影响 */
  load: number;
  /** 施工封路到几点；< 0 表示这条路没在修 */
  openAt: number;
  /** 封着的时候要额外付出的分钟数 */
  penalty: number;
}

export interface RoadNetwork {
  graph: GraphModel;
  edges: RoadEdge[];
  source: number;
  target: number;
  /** 高峰强度；0 时路网退化成一张静态图 */
  rush: number;
  /** 允许在节点等待 */
  waiting: boolean;
  /** 正在施工的边下标（含反向） */
  roadworks: number[];
}

export function buildNetwork(config: FastestConfig): RoadNetwork {
  const graph = generateGeometricGraph({
    nodeCount: config.nodeCount,
    degree: config.degree,
    seed: config.seed,
  });

  const random = seededRandom(config.seed * 104729 + 7);
  const edges: RoadEdge[] = graph.edges.map(() => ({
    free: 0,
    load: 0,
    openAt: -1,
    penalty: 0,
  }));

  graph.edges.forEach((edge, index) => {
    if (index > edge.reverse) {
      edges[index] = { ...edges[edge.reverse] };
      return;
    }
    edges[index].free = Math.max(4, Math.round(edge.length * 55) + 3);
    // 两类路：快速路几乎不受高峰影响，市区路会堵到两倍以上。
    // 敏感度取两极而不是均匀分布，最优路线才会真的随时刻切换 ——
    // 如果所有路一起变慢同样的倍数，那名次不变，这一页就没什么可看的了。
    edges[index].load =
      random() < 0.4 ? 0.05 + random() * 0.2 : 0.6 + random() * 0.4;
  });

  const { source, target } = farthestPair(graph);
  const network: RoadNetwork = {
    graph,
    edges,
    source,
    target,
    rush: config.rush,
    waiting: config.waiting,
    roadworks: [],
  };

  if (config.roadwork) network.roadworks = placeRoadwork(network);
  return network;
}

/**
 * 把施工路段放在自由流最短路的正中间。
 *
 * 随便挑一条边去封，多半封在没人走的角落里，什么也看不出来。
 * 封在主干道上，「绕路 / 等放行」这个两难才真的成立 ——
 * 而这一页要讲的 FIFO 违例，正是从这个两难里长出来的。
 */
function placeRoadwork(network: RoadNetwork): number[] {
  const free = Float64Array.from(network.edges, edge => edge.free);
  const { parent } = dijkstraFixed(network.graph, free, network.source);
  const path = tracePath(parent, network.source, network.target);
  if (path.length < 2) return [];

  const hop = Math.floor((path.length - 1) / 2);
  const edge = network.graph.outgoing[path[hop]].find(
    candidate => network.graph.edges[candidate].to === path[hop + 1]
  );
  if (edge === undefined) return [];

  const back = network.graph.edges[edge].reverse;
  for (const index of [edge, back]) {
    network.edges[index].openAt = ROADWORK_OPEN_AT;
    network.edges[index].penalty = ROADWORK_PENALTY;
  }
  return [edge, back];
}

/** 把任意时刻折算到一天之内 */
export function phaseOf(time: number) {
  return ((time % DAY) + DAY) % DAY;
}

/** 高峰造成的额外倍率（0 表示畅通） */
export function congestion(network: RoadNetwork, edge: number, time: number) {
  const phase = phaseOf(time);
  const shape =
    bump(phase, MORNING_PEAK, MORNING_WIDTH) +
    bump(phase, EVENING_PEAK, EVENING_WIDTH);
  return network.rush * network.edges[edge].load * shape;
}

/** 某时刻出发，走完这条边要多少分钟 */
export function travelTime(
  network: RoadNetwork,
  edge: number,
  time: number
): number {
  const road = network.edges[edge];
  const blocked = road.openAt >= 0 && phaseOf(time) < road.openAt;
  return (
    road.free * (1 + congestion(network, edge, time)) +
    (blocked ? road.penalty : 0)
  );
}

/**
 * 某时刻到达 u，从这条边离开，最早几点能到对面。
 *
 * 允许等待时多考虑一个候选：一直等到施工放行再走。平滑的高峰曲线上等待
 * 永远不划算（那条曲线本身满足 FIFO，晚出发只会晚到），所以只有施工路段
 * 需要多试这一下 —— 不必对连续时间做搜索。
 */
export function departureFor(
  network: RoadNetwork,
  edge: number,
  time: number
): number {
  if (!network.waiting) return time;
  const road = network.edges[edge];
  if (road.openAt < 0) return time;
  const phase = phaseOf(time);
  if (phase >= road.openAt) return time;

  const openTime = time + (road.openAt - phase);
  return openTime + travelTime(network, edge, openTime) <
    time + travelTime(network, edge, time)
    ? openTime
    : time;
}

/** 某时刻到达 u，沿这条边走，最早的到达时刻 */
export function arriveVia(
  network: RoadNetwork,
  edge: number,
  time: number
): number {
  const depart = departureFor(network, edge, time);
  return depart + travelTime(network, edge, depart);
}

/** 沿一条给定路线跑一趟，返回每个节点的到达时刻 */
export function simulate(
  network: RoadNetwork,
  path: number[],
  departure: number
): number[] {
  const times = [departure];
  for (let i = 1; i < path.length; i++) {
    const edge = network.graph.outgoing[path[i - 1]].find(
      candidate => network.graph.edges[candidate].to === path[i]
    );
    if (edge === undefined) return times;
    times.push(arriveVia(network, edge, times[i - 1]));
  }
  return times;
}

/**
 * 固定权重的 Dijkstra。
 *
 * 这一页拿它做两件事：给施工路段找主干道，以及算出「不看路况、只按
 * 自由流时间」选的那条静态路线 —— 也就是没有实时交通数据的导航会给的答案。
 */
export function dijkstraFixed(
  graph: GraphModel,
  cost: Float64Array,
  source: number
) {
  const count = graph.nodes.length;
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
    for (const edge of graph.outgoing[node]) {
      const next = graph.edges[edge].to;
      const candidate = dist[node] + cost[edge];
      if (candidate < dist[next] - 1e-9) {
        dist[next] = candidate;
        parent[next] = node;
        heap.push(candidate, sequence++, next);
      }
    }
  }

  return { dist, parent };
}

/**
 * 多标签搜索：每个节点保留若干个不同的到达时刻，逐一往下展开。
 *
 * Dijkstra 只给每个节点留**一个**标签 —— 最早的那个 —— 靠的是 FIFO：
 * 早到总不吃亏。施工路段一出现这个前提就没了：8:50 赶到路口反而要多等
 * 90 分钟，9:05 才到的那辆车倒能直接过。这时候「最早到达」不再是唯一
 * 值得记住的状态。
 *
 * 于是这里给每个节点留 `maxLabels` 个标签。它不声称找到全局最优
 * （不允许等待的非 FIFO 最早到达问题一般是 NP 困难的），但只要它拿出
 * 一条比 Dijkstra 更早到的路线，就足以证明 Dijkstra 的答案不是最优 ——
 * 这一页要说的正是这句话。FIFO 成立时它与 Dijkstra 必然给出同一个结果。
 */
export function bestArrival(
  network: RoadNetwork,
  source: number,
  target: number,
  departure: number,
  maxLabels = 8
): { arrival: number; path: number[] } {
  const count = network.graph.nodes.length;
  const arrivals = [departure];
  const nodes = [source];
  const parents = [-1];
  const expanded = new Int32Array(count);

  const heap = new MinHeap();
  heap.push(departure, 0, 0);

  const trace = (label: number) => {
    const path: number[] = [];
    for (let at = label; at >= 0; at = parents[at]) path.push(nodes[at]);
    return path.reverse();
  };

  let guard = count * maxLabels * 8 + 128;
  while (heap.size > 0 && guard-- > 0) {
    const label = heap.pop();
    const node = nodes[label];
    if (node === target) {
      return { arrival: arrivals[label], path: trace(label) };
    }
    if (expanded[node] >= maxLabels) continue;
    expanded[node]++;

    for (const edge of network.graph.outgoing[node]) {
      const next = network.graph.edges[edge].to;
      // 原路折返只是在烧时间，那件事留给「允许等待」那个开关去表达
      if (parents[label] >= 0 && nodes[parents[label]] === next) continue;
      const id = arrivals.length;
      arrivals.push(arriveVia(network, edge, arrivals[label]));
      nodes.push(next);
      parents.push(label);
      heap.push(arrivals[id], id, id);
    }
  }

  return { arrival: Infinity, path: [] };
}

/**
 * 一整天的到达曲线：每隔 `PROFILE_STEP` 分钟发一趟车，各要走多久。
 *
 * 用多标签搜索而不是 Dijkstra 算，曲线画的才是「这个时刻出发最好能有多快」，
 * 而不是「某个算法认为能有多快」。相邻两点到达时刻倒挂的地方就是 FIFO 违例。
 */
export function arrivalProfile(
  network: RoadNetwork,
  source: number,
  target: number
): ProfileSample[] {
  const samples: ProfileSample[] = [];
  for (let departure = 0; departure < DAY; departure += PROFILE_STEP) {
    const { arrival } = bestArrival(network, source, target, departure);
    samples.push({ departure, arrival, duration: arrival - departure });
  }
  return samples;
}

/** 高峰的钟形曲线，跨零点也要连得上 */
function bump(phase: number, center: number, width: number) {
  let delta = Math.abs(phase - center);
  if (delta > DAY / 2) delta = DAY - delta;
  return Math.exp(-(delta * delta) / (2 * width * width));
}

/** 分钟数 → HH:MM，跨天的部分折回去 */
export function formatClock(time: number) {
  const phase = Math.round(phaseOf(time));
  const hours = Math.floor(phase / 60);
  const minutes = phase % 60;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
}
