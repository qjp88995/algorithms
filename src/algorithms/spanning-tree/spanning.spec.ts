import { describe, expect, it } from 'vitest';

import { DisjointSet } from '@/lib/disjoint-set';
import { buildGraph, type GraphModel } from '@/lib/graph/model';

import { defaultConfig } from './constants';
import {
  compareLinks,
  compareTrees,
  referenceTree,
  shortestPathTree,
  undirectedLinks,
} from './reference';
import { buildScene, type SpanningScene } from './scene';
import { SpanningTreeRun } from './spanning';
import type { SpanningAlgorithm, SpanningConfig } from './types';

const ALGORITHMS: SpanningAlgorithm[] = ['kruskal', 'prim', 'boruvka'];

function makeConfig(patch: Partial<SpanningConfig> = {}): SpanningConfig {
  return { ...defaultConfig, ...patch };
}

/**
 * 手搭一个场景。`links` 里第 i 条连线对应有向边 2i（正向）与 2i+1（反向），
 * 无向代表下标就是 2i；`weights` 按无向连线给，正反两向自动同价。
 */
function makeScene(
  links: [number, number][],
  linkWeights: number[],
  nodeCount: number
): SpanningScene {
  const nodes = Array.from({ length: nodeCount }, (_, i) => ({
    x: i / Math.max(1, nodeCount - 1),
    y: (i % 2) * 0.5,
  }));
  const graph = buildGraph(nodes, links);
  const weights = new Float64Array(graph.edges.length);
  linkWeights.forEach((weight, index) => {
    weights[index * 2] = weight;
    weights[index * 2 + 1] = weight;
  });
  const all = undirectedLinks(graph);
  return {
    graph,
    weights,
    links: all,
    sortedLinks: [...all].sort(compareLinks(weights)),
    reference: referenceTree(graph, weights),
    root: 0,
  };
}

function solve(
  scene: SpanningScene,
  algorithm: SpanningAlgorithm,
  root = scene.root
) {
  const run = new SpanningTreeRun(scene, algorithm, root);
  run.runToEnd();
  return run;
}

/**
 * 三角形：A-B 3、A-C 3、B-C 2。
 *
 * 最小生成树取 {B-C=2, A-B=3}，总权 5；从 A 出发的最短路树取
 * {A-B=3, A-C=3}，总权 6。反过来，沿生成树从 A 走到 C 要 5，
 * 而真正的最短是 3 —— 两棵树各自最优的东西根本不是一回事。
 */
function triangle(): SpanningScene {
  return makeScene(
    [
      [0, 1],
      [0, 2],
      [1, 2],
    ],
    [3, 3, 2],
    3
  );
}

/** 树上 u 到 v 的路径经过的最大边权；不连通返回 -1 */
function heaviestOnPath(
  graph: GraphModel,
  weights: Float64Array,
  treeLinks: number[],
  from: number,
  to: number
) {
  const adjacency: number[][] = graph.nodes.map(() => []);
  for (const link of treeLinks) {
    adjacency[graph.edges[link].from].push(link);
    adjacency[graph.edges[link].to].push(link);
  }
  const worst = new Float64Array(graph.nodes.length).fill(-1);
  const seen = new Uint8Array(graph.nodes.length);
  seen[from] = 1;
  worst[from] = 0;
  const queue = [from];
  for (let head = 0; head < queue.length; head++) {
    const node = queue[head];
    for (const link of adjacency[node]) {
      const edge = graph.edges[link];
      const next = edge.from === node ? edge.to : edge.from;
      if (seen[next]) continue;
      seen[next] = 1;
      worst[next] = Math.max(worst[node], weights[link]);
      queue.push(next);
    }
  }
  return seen[to] ? worst[to] : -1;
}

describe('SpanningTreeRun', () => {
  it('三个算法长出同一棵树，总权重等于标准答案', () => {
    for (const seed of [1, 2, 3, 4]) {
      const scene = buildScene(makeConfig({ seed, nodeCount: 14 }));
      const expected = new Set(scene.reference.links);
      for (const algorithm of ALGORITHMS) {
        const run = solve(scene, algorithm);
        const stats = run.stats();
        expect(run.done, algorithm).toBe(true);
        expect(stats.weight, `${algorithm} seed=${seed}`).toBeCloseTo(
          scene.reference.weight
        );
        // 权重并列时靠「下标小的优先」凑成全序，边集才会完全一致
        expect(new Set(run.chosen), `${algorithm} seed=${seed}`).toEqual(
          expected
        );
        expect(stats.optimal, algorithm).toBe(true);
      }
    }
  });

  it('选中的边正好构成一棵生成树：V−1 条、连通、无环', () => {
    const scene = buildScene(makeConfig({ seed: 7, nodeCount: 16, degree: 4 }));
    for (const algorithm of ALGORITHMS) {
      const run = solve(scene, algorithm);
      const count = scene.graph.nodes.length;
      expect(run.chosen.length, algorithm).toBe(count - 1);

      const dsu = new DisjointSet(count);
      for (const link of run.chosen) {
        const { from, to } = scene.graph.edges[link];
        // 每条边都真的合并了两块 —— 合并失败就说明成了环
        expect(dsu.union(from, to), `${algorithm} 边 ${link} 成环`).toBe(true);
      }
      expect(dsu.count, algorithm).toBe(1);
      expect(run.stats().components, algorithm).toBe(1);
    }
  });

  it('环性质：任何一条落选的边，都是它那个环上最重的', () => {
    const scene = buildScene(
      makeConfig({ seed: 11, nodeCount: 15, degree: 4 })
    );
    const tree = scene.reference.links;
    const inTree = new Set(tree);
    for (const link of scene.links) {
      if (inTree.has(link)) continue;
      const { from, to } = scene.graph.edges[link];
      const heaviest = heaviestOnPath(
        scene.graph,
        scene.weights,
        tree,
        from,
        to
      );
      // 树上那条路里最重的一段都不比它贵，换上去只会更差 —— 贪心没有漏掉更优解
      expect(heaviest, `边 ${link}`).toBeLessThanOrEqual(scene.weights[link]);
    }
  });

  it('最小生成树不是最短路树 —— 三角形上就能看出来', () => {
    const scene = triangle();
    const run = solve(scene, 'kruskal', 0);
    expect(new Set(run.chosen)).toEqual(new Set([4, 0]));
    expect(run.stats().weight).toBe(5);

    const spt = shortestPathTree(scene.graph, scene.weights, 0);
    expect(new Set(spt.links)).toEqual(new Set([0, 2]));
    expect(spt.weight).toBe(6);

    const comparison = compareTrees(
      scene.graph,
      scene.weights,
      scene.reference.links,
      0
    );
    // 沿生成树从 A 到 C 要 3+2=5，真正的最短是 3
    expect(comparison.viaTree[2]).toBe(5);
    expect(comparison.shortest[2]).toBe(3);
    expect(comparison.worstNode).toBe(2);
    expect(comparison.worstRatio).toBeCloseTo(5 / 3);
    expect(comparison.differing).toBe(1);
  });

  it('生成树总权重不会超过最短路树，而绕远是常态', () => {
    let sawDetour = false;
    for (const seed of [1, 2, 3, 4, 5, 6]) {
      const scene = buildScene(makeConfig({ seed, nodeCount: 16 }));
      const comparison = compareTrees(
        scene.graph,
        scene.weights,
        scene.reference.links,
        scene.root
      );
      expect(scene.reference.weight, `seed=${seed}`).toBeLessThanOrEqual(
        comparison.weight
      );
      // 沿生成树走永远不会比真正的最短路更近
      for (let node = 0; node < scene.graph.nodes.length; node++) {
        expect(comparison.viaTree[node]).toBeGreaterThanOrEqual(
          comparison.shortest[node] - 1e-9
        );
      }
      if (comparison.worstRatio > 1.2) sawDetour = true;
    }
    expect(sawDetour).toBe(true);
  });

  it('单步累加起来和一口气跑到底是同一个结果', () => {
    const scene = buildScene(makeConfig({ seed: 5, nodeCount: 12 }));
    for (const algorithm of ALGORITHMS) {
      const stepwise = new SpanningTreeRun(scene, algorithm, scene.root);
      let guard = 0;
      while (!stepwise.step() && guard++ < 100000);
      const batch = solve(scene, algorithm);
      expect(stepwise.chosen, algorithm).toEqual(batch.chosen);
      expect(stepwise.stats().checks, algorithm).toBe(batch.stats().checks);
    }
  });

  it('Borůvka 的轮数不超过 log₂V', () => {
    for (const nodeCount of [8, 14, 20]) {
      const scene = buildScene(makeConfig({ seed: 3, nodeCount }));
      const run = solve(scene, 'boruvka');
      const stats = run.stats();
      expect(stats.round, `V=${nodeCount}`).toBeLessThanOrEqual(
        stats.totalRounds
      );
      expect(stats.round).toBeGreaterThan(0);
    }
  });

  it('换根不改变 Kruskal 和 Borůvka 的结果，Prim 也一样', () => {
    const scene = buildScene(makeConfig({ seed: 9, nodeCount: 13 }));
    for (const algorithm of ALGORITHMS) {
      const first = solve(scene, algorithm, 0);
      const second = solve(scene, algorithm, scene.graph.nodes.length - 1);
      expect(new Set(second.chosen), algorithm).toEqual(new Set(first.chosen));
    }
  });

  it('图不连通时：Kruskal 和 Borůvka 给森林，Prim 只长出根那一块', () => {
    // 两个互不相连的分量：0-1-2 和 3-4
    const scene = makeScene(
      [
        [0, 1],
        [1, 2],
        [3, 4],
      ],
      [1, 2, 3],
      5
    );
    expect(scene.reference.links.length).toBe(3);

    for (const algorithm of ['kruskal', 'boruvka'] as const) {
      const run = solve(scene, algorithm, 0);
      expect(run.chosen.length, algorithm).toBe(3);
      expect(run.stats().components, algorithm).toBe(2);
      expect(run.stats().optimal, algorithm).toBe(true);
    }

    const prim = solve(scene, 'prim', 0);
    expect(prim.chosen.length).toBe(2);
    expect(prim.stats().optimal).toBe(false);
    expect([...prim.covered]).toEqual([1, 1, 1, 0, 0]);
  });

  it('权重全部并列时三个算法仍然挑中同一批边', () => {
    // 四个点连成一圈，每条边都是 5：没有次级比较键就会各挑各的
    const scene = makeScene(
      [
        [0, 1],
        [1, 2],
        [2, 3],
        [3, 0],
      ],
      [5, 5, 5, 5],
      4
    );
    const expected = new Set(scene.reference.links);
    expect(expected.size).toBe(3);
    for (const algorithm of ALGORITHMS) {
      expect(new Set(solve(scene, algorithm, 0).chosen), algorithm).toEqual(
        expected
      );
    }
  });

  it('三个算法的工作量不一样：Prim 和 Kruskal 差在边排序上', () => {
    const scene = buildScene(makeConfig({ seed: 8, nodeCount: 20, degree: 4 }));
    const checks = Object.fromEntries(
      ALGORITHMS.map(algorithm => [algorithm, solve(scene, algorithm).stats()])
    );
    // Kruskal 最多把每条边看一遍
    expect(checks.kruskal.checks).toBeLessThanOrEqual(scene.links.length);
    // Borůvka 每轮都要重扫一遍全部边，所以看的次数最多
    expect(checks.boruvka.checks).toBeGreaterThan(checks.kruskal.checks);
    for (const stats of Object.values(checks)) {
      expect(stats.optimal).toBe(true);
    }
  });
});

describe('buildScene', () => {
  it('正反两向同权，权重都在 1…9 之间', () => {
    const scene = buildScene(makeConfig({ seed: 5, nodeCount: 12 }));
    scene.graph.edges.forEach((edge, index) => {
      expect(scene.weights[index]).toBe(scene.weights[edge.reverse]);
      expect(scene.weights[index]).toBeGreaterThanOrEqual(1);
      expect(scene.weights[index]).toBeLessThanOrEqual(9);
    });
  });

  it('排好序的那份就是按 (权重, 下标) 的全序', () => {
    const scene = buildScene(makeConfig({ seed: 6, nodeCount: 15 }));
    expect(scene.sortedLinks.length).toBe(scene.links.length);
    for (let i = 1; i < scene.sortedLinks.length; i++) {
      const previous = scene.sortedLinks[i - 1];
      const current = scene.sortedLinks[i];
      const diff = scene.weights[previous] - scene.weights[current];
      expect(diff < 0 || (diff === 0 && previous < current)).toBe(true);
    }
  });
});
