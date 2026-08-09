import { describe, expect, it } from 'vitest';

import { buildGraph } from '@/lib/graph/model';

import { defaultConfig } from './constants';
import { exactDistances, hasNegativeCycle } from './reference';
import { buildScene, type ShortestScene } from './scene';
import { ShortestPathRun } from './shortest';
import type { ShortestAlgorithm, ShortestConfig } from './types';

const ALGORITHMS: ShortestAlgorithm[] = [
  'dijkstra',
  'bellman-ford',
  'floyd-warshall',
];

/**
 * 手搭一个场景。`links` 里第 i 条连线对应有向边 2i（正向）与 2i+1（反向），
 * `weights` 按这个下标给，正反可以不一样。
 */
function makeScene(
  links: [number, number][],
  weights: number[],
  nodeCount: number
): ShortestScene {
  const nodes = Array.from({ length: nodeCount }, (_, i) => ({
    x: i / Math.max(1, nodeCount - 1),
    y: (i % 2) * 0.5,
  }));
  return {
    graph: buildGraph(nodes, links),
    weights: Float64Array.from(weights),
    negativeEdges: weights.flatMap((w, i) => (w < 0 ? [i] : [])),
    cycleEdges: [],
    source: 0,
    target: nodeCount - 1,
  };
}

function solve(
  scene: ShortestScene,
  algorithm: ShortestAlgorithm,
  source = scene.source,
  target = scene.target
) {
  const run = new ShortestPathRun(scene, algorithm, source, target);
  run.runToEnd();
  return run;
}

function makeConfig(patch: Partial<ShortestConfig> = {}): ShortestConfig {
  return { ...defaultConfig, ...patch };
}

/**
 * Dijkstra 的经典反例：A→B 直达要 2，但绕 C 走是 5 + (−4) = 1。
 * B 在距离还是 2 的时候就被定稿，之后那条 −4 再也进不来。
 */
function negativeEdgeTrap(): ShortestScene {
  return makeScene(
    [
      [0, 1],
      [0, 2],
      [2, 1],
    ],
    [2, 2, 5, 5, -4, 6],
    3
  );
}

describe('ShortestPathRun', () => {
  it('正权图上三个算法给出同一张距离表', () => {
    for (const seed of [1, 2, 3]) {
      const scene = buildScene(makeConfig({ seed, nodeCount: 10 }));
      const exact = exactDistances(scene.graph, scene.weights, scene.source);
      for (const algorithm of ALGORITHMS) {
        const run = solve(scene, algorithm);
        expect(run.done, algorithm).toBe(true);
        for (let v = 0; v < scene.graph.nodes.length; v++) {
          expect(
            run.dist[v],
            `${algorithm} seed=${seed} node=${v}`
          ).toBeCloseTo(exact[v]);
        }
        expect(run.stats().wrong, algorithm).toBe(0);
      }
    }
  });

  it('路径上的权重之和等于报出来的距离', () => {
    const scene = buildScene(makeConfig({ seed: 4, nodeCount: 12 }));
    for (const algorithm of ALGORITHMS) {
      const run = solve(scene, algorithm);
      const path = run.path();
      expect(path.length, algorithm).toBeGreaterThan(1);
      expect(path[0]).toBe(scene.source);
      expect(path[path.length - 1]).toBe(scene.target);

      let total = 0;
      for (let i = 1; i < path.length; i++) {
        const edge = scene.graph.outgoing[path[i - 1]].find(
          candidate => scene.graph.edges[candidate].to === path[i]
        );
        expect(edge, `${algorithm} 第 ${i} 段不是一条真实的边`).toBeDefined();
        total += scene.weights[edge!];
      }
      expect(total, algorithm).toBeCloseTo(run.stats().distance);
    }
  });

  it('负权边上 Dijkstra 会答错，另外两个不会', () => {
    const scene = negativeEdgeTrap();
    const exact = exactDistances(scene.graph, scene.weights, 0);
    expect(exact[1]).toBe(1);

    const dijkstra = solve(scene, 'dijkstra', 0, 1);
    expect(dijkstra.dist[1]).toBe(2);
    expect(dijkstra.stats().wrong).toBe(1);
    expect(dijkstra.isWrong(1)).toBe(true);

    for (const algorithm of ['bellman-ford', 'floyd-warshall'] as const) {
      const run = solve(scene, algorithm, 0, 1);
      expect(run.dist[1], algorithm).toBe(1);
      expect(run.stats().wrong, algorithm).toBe(0);
    }
  });

  it('答错的判定只在跑完之后才作数', () => {
    const scene = negativeEdgeTrap();
    const run = new ShortestPathRun(scene, 'dijkstra', 0, 1);
    run.step();
    expect(run.stats().wrong).toBe(0);
    expect(run.isWrong(1)).toBe(false);
  });

  it('Bellman-Ford 报出负环，并给出环上的点', () => {
    // A→B→C→A 每条 −1，反向都是 +4：绕一圈是 −3
    const scene = makeScene(
      [
        [0, 1],
        [1, 2],
        [2, 0],
      ],
      [-1, 4, -1, 4, -1, 4],
      3
    );
    expect(hasNegativeCycle(scene.graph, scene.weights)).toBe(true);

    const run = solve(scene, 'bellman-ford', 0, 2);
    const stats = run.stats();
    expect(stats.negativeCycle).toBe(true);
    expect(new Set(run.negativeCycleNodes)).toEqual(new Set([0, 1, 2]));
    // 有负环时"最短距离"不存在，就不该再去判谁对谁错
    expect(stats.wrong).toBe(0);

    const floyd = solve(scene, 'floyd-warshall', 0, 2);
    expect(floyd.stats().negativeCycle).toBe(true);
  });

  it('Dijkstra 遇到负环不会转圈 —— 它只是给个错答案', () => {
    const scene = makeScene(
      [
        [0, 1],
        [1, 2],
        [2, 0],
      ],
      [-1, 4, -1, 4, -1, 4],
      3
    );
    const run = solve(scene, 'dijkstra', 0, 2);
    expect(run.done).toBe(true);
    expect(run.stats().negativeCycle).toBe(false);
  });

  it('单步累加起来和一口气跑到底是同一个结果', () => {
    const scene = buildScene(makeConfig({ seed: 6, nodeCount: 9 }));
    for (const algorithm of ALGORITHMS) {
      const stepwise = new ShortestPathRun(
        scene,
        algorithm,
        scene.source,
        scene.target
      );
      let guard = 0;
      while (!stepwise.step() && guard++ < 200000);
      const batch = solve(scene, algorithm);
      expect([...stepwise.dist], algorithm).toEqual([...batch.dist]);
      expect(stepwise.stats().checks, algorithm).toBe(batch.stats().checks);
    }
  });

  it('三个算法的工作量差着数量级', () => {
    const scene = buildScene(makeConfig({ seed: 8, nodeCount: 14 }));
    const checks = Object.fromEntries(
      ALGORITHMS.map(algorithm => [
        algorithm,
        solve(scene, algorithm).stats().checks,
      ])
    );
    expect(checks.dijkstra).toBeLessThan(checks['bellman-ford']);
    expect(checks['bellman-ford']).toBeLessThan(checks['floyd-warshall']);
    // Floyd 雷打不动跑满 V³ 次，图多稀疏都一样
    expect(checks['floyd-warshall']).toBe(14 ** 3);
  });

  it('Bellman-Ford 一轮没改动就收工，不会硬跑满 V−1 轮', () => {
    const scene = buildScene(makeConfig({ seed: 2, nodeCount: 16 }));
    const run = solve(scene, 'bellman-ford');
    const stats = run.stats();
    expect(stats.done).toBe(true);
    expect(stats.checks).toBeLessThan(
      (scene.graph.nodes.length - 1) * scene.graph.edges.length
    );
  });

  it('不可达的节点距离保持无穷，路径为空', () => {
    // 两个互不相连的分量：0-1 和 2-3
    const scene = makeScene(
      [
        [0, 1],
        [2, 3],
      ],
      [1, 1, 1, 1],
      4
    );
    for (const algorithm of ALGORITHMS) {
      const run = solve(scene, algorithm, 0, 3);
      expect(run.dist[3], algorithm).toBe(Infinity);
      expect(run.path(), algorithm).toEqual([]);
      expect(run.stats().reached, algorithm).toBe(false);
    }
  });
});

describe('buildScene', () => {
  it('负权比例拉满也不会意外长出负环', () => {
    for (const seed of [1, 2, 3, 4, 5, 6]) {
      const scene = buildScene(
        makeConfig({ seed, nodeCount: 14, degree: 4, negativeRatio: 1 })
      );
      expect(scene.negativeEdges.length, `seed=${seed}`).toBeGreaterThan(0);
      expect(hasNegativeCycle(scene.graph, scene.weights), `seed=${seed}`).toBe(
        false
      );
    }
  });

  it('负权比例为 0 时全是正权', () => {
    const scene = buildScene(makeConfig({ seed: 3, negativeRatio: 0 }));
    expect(scene.negativeEdges).toEqual([]);
    expect([...scene.weights].every(w => w > 0)).toBe(true);
  });

  it('打开开关就一定有负环，而且圈出了它', () => {
    for (const seed of [1, 2, 3]) {
      const scene = buildScene(
        makeConfig({ seed, nodeCount: 12, degree: 4, negativeCycle: true })
      );
      expect(hasNegativeCycle(scene.graph, scene.weights), `seed=${seed}`).toBe(
        true
      );
      expect(scene.cycleEdges.length).toBeGreaterThanOrEqual(2);
      const total = scene.cycleEdges.reduce(
        (sum, edge) => sum + scene.weights[edge],
        0
      );
      expect(total).toBeLessThan(0);
    }
  });

  it('正反两向默认同权，起终点取图上最远的一对', () => {
    const scene = buildScene(makeConfig({ seed: 5, nodeCount: 12 }));
    scene.graph.edges.forEach((edge, index) => {
      expect(scene.weights[index]).toBe(scene.weights[edge.reverse]);
    });
    expect(scene.source).not.toBe(scene.target);
  });
});
