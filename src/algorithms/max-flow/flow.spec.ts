import { describe, expect, it } from 'vitest';

import { defaultConfig, DIAMOND_CAPACITY } from './constants';
import { MaxFlowRun } from './flow';
import { buildScene, type FlowScene } from './network';
import {
  cutCapacity,
  cutEdges,
  referenceMaxFlow,
  sourceSide,
} from './reference';
import type { FlowAlgorithm, FlowConfig } from './types';

const ALGORITHMS: FlowAlgorithm[] = ['ford-fulkerson', 'edmonds-karp', 'dinic'];

function makeConfig(patch: Partial<FlowConfig> = {}): FlowConfig {
  return { ...defaultConfig, preset: 'random', ...patch };
}

function solve(scene: FlowScene, algorithm: FlowAlgorithm) {
  const run = new MaxFlowRun(scene, algorithm);
  run.runToEnd();
  return run;
}

/** 流本身合法吗：不超容量、反对称、中间点不囤积 */
function expectValidFlow(scene: FlowScene, run: MaxFlowRun, label: string) {
  const { graph, capacity, source, sink } = scene;

  graph.edges.forEach((edge, index) => {
    expect(run.flow[index], `${label} 边 ${index} 超容量`).toBeLessThanOrEqual(
      capacity[index] + 1e-9
    );
    expect(run.flow[index], `${label} 边 ${index} 不反对称`).toBeCloseTo(
      -run.flow[edge.reverse]
    );
  });

  for (let node = 0; node < graph.nodes.length; node++) {
    const net = graph.outgoing[node].reduce(
      (sum, edge) => sum + run.flow[edge],
      0
    );
    if (node === source)
      expect(net, `${label} 源点净流出`).toBeCloseTo(run.stats().value);
    else if (node === sink)
      expect(net, `${label} 汇点净流出`).toBeCloseTo(-run.stats().value);
    else expect(net, `${label} 点 ${node} 没守恒`).toBeCloseTo(0);
  }
}

describe('MaxFlowRun', () => {
  it('三个算法给出同一个最大流，等于标准答案', () => {
    for (const seed of [1, 2, 3, 4]) {
      const scene = buildScene(makeConfig({ seed, nodeCount: 12 }));
      expect(scene.maxFlow, `seed=${seed}`).toBeGreaterThan(0);
      for (const algorithm of ALGORITHMS) {
        const run = solve(scene, algorithm);
        const stats = run.stats();
        expect(run.done, algorithm).toBe(true);
        expect(stats.value, `${algorithm} seed=${seed}`).toBeCloseTo(
          scene.maxFlow
        );
        expect(stats.optimal, algorithm).toBe(true);
        expectValidFlow(scene, run, `${algorithm} seed=${seed}`);
      }
    }
  });

  it('最大流等于最小割，而且割上每条边都饱和了', () => {
    for (const seed of [5, 6, 7]) {
      const scene = buildScene(makeConfig({ seed, nodeCount: 14, degree: 4 }));
      for (const algorithm of ALGORITHMS) {
        const run = solve(scene, algorithm);
        const cut = run.minCut()!;
        expect(cut.capacity, `${algorithm} seed=${seed}`).toBeCloseTo(
          scene.maxFlow
        );
        expect(cut.edges.length).toBeGreaterThan(0);
        for (const edge of cut.edges) {
          // 割上的边全都推满了 —— 它们就是把流卡住的那几条
          expect(run.residualOf(edge), `边 ${edge} 没饱和`).toBeCloseTo(0);
        }
      }
    }
  });

  it('割把源点和汇点分在两边', () => {
    const scene = buildScene(makeConfig({ seed: 8, nodeCount: 13 }));
    const run = solve(scene, 'dinic');
    const side = run.side();
    expect(side[scene.source]).toBe(1);
    expect(side[scene.sink]).toBe(0);
    expect(
      cutCapacity(scene.capacity, cutEdges(scene.graph, scene.capacity, side))
    ).toBeCloseTo(scene.maxFlow);
  });

  it('钻石图上三个算法的代价差得很明显', () => {
    const scene = buildScene({ ...defaultConfig, preset: 'diamond' });
    expect(scene.maxFlow).toBe(DIAMOND_CAPACITY * 2);

    const depth = solve(scene, 'ford-fulkerson');
    const breadth = solve(scene, 'edmonds-karp');
    const dinic = solve(scene, 'dinic');

    // 深度优先一头扎进中间那条容量 1 的边，头一次只推得动 1
    expect(depth.stats().augmentations).toBeGreaterThan(
      breadth.stats().augmentations
    );
    // 广度优先只走两条最短路，压根不碰中间那条边
    expect(breadth.stats().augmentations).toBe(2);
    // Dinic 一个相位就把两条最短路一起榨干
    expect(dinic.stats().phase).toBe(1);

    for (const run of [depth, breadth, dinic]) {
      expect(run.stats().value).toBe(DIAMOND_CAPACITY * 2);
    }
  });

  it('钻石图上深度优先必须靠反向边把流退回去', () => {
    const scene = buildScene({ ...defaultConfig, preset: 'diamond' });
    const run = new MaxFlowRun(scene, 'ford-fulkerson');

    let sawReverse = false;
    let guard = 0;
    while (!run.step() && guard++ < 100000) {
      if (run.lastUsedReverse) sawReverse = true;
    }
    expect(sawReverse, '一次都没退货，说明中间那条边没被走').toBe(true);

    // 中间那条边最终又被退回了 0 —— 走它纯属白费力气
    const middle = 4;
    expect(scene.capacity[middle]).toBe(1);
    expect(run.flow[middle]).toBe(0);

    // 广度优先从头到尾没碰过它
    const breadth = solve(scene, 'edmonds-karp');
    expect(breadth.flow[middle]).toBe(0);
    expect(breadth.stats().usedReverse).toBe(false);
  });

  it('单步累加起来和一口气跑到底是同一个结果', () => {
    const scene = buildScene(makeConfig({ seed: 9, nodeCount: 12 }));
    for (const algorithm of ALGORITHMS) {
      const stepwise = new MaxFlowRun(scene, algorithm);
      let guard = 0;
      while (!stepwise.step() && guard++ < 200000);
      const batch = solve(scene, algorithm);
      expect(stepwise.stats().value, algorithm).toBe(batch.stats().value);
      expect(stepwise.stats().checks, algorithm).toBe(batch.stats().checks);
      expect([...stepwise.flow], algorithm).toEqual([...batch.flow]);
    }
  });

  /**
   * Edmonds-Karp 的复杂度就架在这条性质上：增广路的长度一次比一次长
   * （至少不变短）。路最长 V−1 条边，每个长度上最多推 E 次，于是有了
   * O(V·E²) 这个与流量无关的上界。
   */
  it('Edmonds-Karp 的增广路长度单调不减', () => {
    for (const seed of [2, 4, 6, 8]) {
      const scene = buildScene(makeConfig({ seed, nodeCount: 16, degree: 4 }));
      const run = new MaxFlowRun(scene, 'edmonds-karp');
      let previous = 0;
      let counted = 0;
      let guard = 0;
      while (!run.step() && guard++ < 200000) {
        const augmentations = run.stats().augmentations;
        if (augmentations === counted) continue;
        counted = augmentations;
        expect(
          run.lastPath.length,
          `seed=${seed} 第 ${counted} 条增广路变短了`
        ).toBeGreaterThanOrEqual(previous);
        previous = run.lastPath.length;
      }
      expect(counted, `seed=${seed}`).toBeGreaterThan(1);
    }
  });

  it('Dinic 的相位数不超过节点数', () => {
    for (const nodeCount of [8, 14, 18]) {
      const scene = buildScene(makeConfig({ seed: 3, nodeCount }));
      const stats = solve(scene, 'dinic').stats();
      expect(stats.phase, `V=${nodeCount}`).toBeLessThanOrEqual(nodeCount);
      expect(stats.phase).toBeGreaterThan(0);
    }
  });

  it('源汇被彻底堵死时最大流是 0', () => {
    const scene = buildScene(makeConfig({ seed: 3, nodeCount: 10 }));
    // 把源点的所有出边容量清零，网络就断了
    const capacity = Float64Array.from(scene.capacity);
    for (const edge of scene.graph.outgoing[scene.source]) capacity[edge] = 0;
    const blocked: FlowScene = {
      ...scene,
      capacity,
      maxFlow: referenceMaxFlow(
        scene.graph,
        capacity,
        scene.source,
        scene.sink
      ),
    };
    expect(blocked.maxFlow).toBe(0);

    for (const algorithm of ALGORITHMS) {
      const run = solve(blocked, algorithm);
      expect(run.stats().value, algorithm).toBe(0);
      expect(run.stats().augmentations, algorithm).toBe(0);
      // 割就是源点周围那一圈
      expect(run.minCut()!.capacity, algorithm).toBe(0);
      expect(run.side()[scene.sink], algorithm).toBe(0);
    }
  });

  it('随机网络按层次定向之后不会长出环', () => {
    for (const seed of [1, 5, 9]) {
      const scene = buildScene(makeConfig({ seed, nodeCount: 15, degree: 4 }));
      // 有容量的边构成 DAG：拓扑排序应该能排完所有点
      const indegree = new Int32Array(scene.graph.nodes.length);
      const real = scene.graph.edges.flatMap((edge, index) =>
        scene.capacity[index] > 0 ? [{ index, edge }] : []
      );
      for (const { edge } of real) indegree[edge.to]++;
      const queue: number[] = [];
      indegree.forEach((degree, node) => {
        if (degree === 0) queue.push(node);
      });
      let removed = 0;
      for (let head = 0; head < queue.length; head++) {
        removed++;
        for (const { edge } of real) {
          if (edge.from !== queue[head]) continue;
          if (--indegree[edge.to] === 0) queue.push(edge.to);
        }
      }
      expect(removed, `seed=${seed}`).toBe(scene.graph.nodes.length);
    }
  });
});

describe('buildScene', () => {
  it('反向边一律没有容量，正向容量都在 1…9 之间', () => {
    const scene = buildScene(makeConfig({ seed: 4, nodeCount: 12 }));
    scene.graph.edges.forEach((edge, index) => {
      const paired = scene.capacity[index] + scene.capacity[edge.reverse];
      // 一条连线只有一个方向带容量
      expect(
        Math.min(scene.capacity[index], scene.capacity[edge.reverse])
      ).toBe(0);
      expect(paired).toBeGreaterThanOrEqual(1);
      expect(paired).toBeLessThanOrEqual(9);
    });
  });

  it('钻石图的形状和容量都固定', () => {
    const scene = buildScene({ ...defaultConfig, preset: 'diamond' });
    expect(scene.graph.nodes.length).toBe(4);
    expect(scene.source).toBe(0);
    expect(scene.sink).toBe(3);
    expect(scene.capacity[4]).toBe(1);
    // a 的出边表里，通往 b 的窄路排在通往汇点的宽路前面
    const fromA = scene.graph.outgoing[1].filter(
      edge => scene.capacity[edge] > 0
    );
    expect(scene.graph.edges[fromA[0]].to).toBe(2);
    expect(scene.graph.edges[fromA[1]].to).toBe(3);
  });

  it('源点和汇点不重合，而且汇点确实够得着', () => {
    for (const seed of [1, 2, 3, 4, 5]) {
      const scene = buildScene(makeConfig({ seed, nodeCount: 14 }));
      expect(scene.source, `seed=${seed}`).not.toBe(scene.sink);
      const side = sourceSide(
        scene.graph,
        scene.capacity,
        new Float64Array(scene.graph.edges.length),
        scene.source
      );
      expect(side[scene.sink], `seed=${seed}`).toBe(1);
    }
  });
});
