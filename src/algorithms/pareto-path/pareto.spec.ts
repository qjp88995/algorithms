import { describe, expect, it } from 'vitest';

import { defaultConfig } from './constants';
import {
  buildNetwork,
  costOf,
  type TollNetwork,
  weightedRoute,
} from './network';
import { hullCorners, ParetoRun, pickByLambda } from './pareto';
import type { ParetoConfig } from './types';

function makeConfig(patch: Partial<ParetoConfig> = {}): ParetoConfig {
  return { ...defaultConfig, ...patch };
}

function solve(network: TollNetwork) {
  const run = new ParetoRun(network, network.source, network.target);
  run.runToEnd();
  return run;
}

/** (0,1) 内扫一串偏好权重；两端排除，那里加权和会并列 */
const LAMBDAS = Array.from({ length: 199 }, (_, i) => (i + 1) / 200);

describe('收费路网', () => {
  it('等级越高的路越快也越贵', () => {
    const network = buildNetwork(makeConfig());
    const sorted = [...network.edges].sort((a, b) => a.grade - b.grade);
    const cheap = sorted[0];
    const fancy = sorted[sorted.length - 1];
    expect(fancy.toll).toBeGreaterThan(cheap.toll);
  });

  it('收费强度为 0 时全网免费，第二个目标消失', () => {
    const network = buildNetwork(makeConfig({ spread: 0 }));
    expect(network.edges.every(edge => edge.toll === 0)).toBe(true);

    const solutions = solve(network).solutions();
    expect(solutions).toHaveLength(1);
    expect(solutions[0].supported).toBe(true);
  });

  it('costOf 沿路累加，和标签记下的代价对得上', () => {
    const network = buildNetwork(makeConfig());
    for (const solution of solve(network).solutions()) {
      expect(costOf(network, solution.path)).toEqual({
        time: solution.time,
        toll: solution.toll,
      });
    }
  });
});

describe('ParetoRun', () => {
  it('前沿上的解互不支配 —— 越快必然越贵', () => {
    const network = buildNetwork(makeConfig());
    const solutions = solve(network).solutions();
    expect(solutions.length).toBeGreaterThan(1);
    for (let i = 1; i < solutions.length; i++) {
      expect(solutions[i].time).toBeGreaterThan(solutions[i - 1].time);
      expect(solutions[i].toll).toBeLessThan(solutions[i - 1].toll);
    }
  });

  it('两个极端解就是两个单目标最短路', () => {
    const network = buildNetwork(makeConfig());
    const solutions = solve(network).solutions();
    const fastest = solutions[0];
    const cheapest = solutions[solutions.length - 1];

    // λ=1 只看时间，λ=0 只看钱；并列时 Dijkstra 挑哪条不定，只比代价
    expect(
      weightedRoute(network, 1, network.source, network.target)?.time
    ).toBe(fastest.time);
    expect(
      weightedRoute(network, 0, network.source, network.target)?.toll
    ).toBe(cheapest.toll);
  });

  it('每条路线都真的从起点走到终点', () => {
    const network = buildNetwork(makeConfig());
    for (const solution of solve(network).solutions()) {
      expect(solution.path[0]).toBe(network.source);
      expect(solution.path[solution.path.length - 1]).toBe(network.target);
      expect(new Set(solution.path).size).toBe(solution.path.length);
    }
  });

  it('支配剪枝确实在干活：生成的标签远多于活下来的', () => {
    const network = buildNetwork(makeConfig());
    const stats = solve(network).stats();
    expect(stats.done).toBe(true);
    expect(stats.overflow).toBe(false);
    expect(stats.pruned + stats.dropped).toBeGreaterThan(0);
    expect(stats.created).toBeGreaterThan(stats.frontier);
  });

  it('单步累加起来和一口气跑到底是同一个结果', () => {
    const network = buildNetwork(makeConfig({ nodeCount: 12 }));
    const stepwise = new ParetoRun(network, network.source, network.target);
    let guard = 0;
    while (!stepwise.step() && guard++ < 200000);
    const batch = solve(network);
    expect(stepwise.solutions()).toEqual(batch.solutions());
    expect(stepwise.stats().checks).toBe(batch.stats().checks);
  });

  it('换一批图也照样成立', () => {
    for (const seed of [3, 17, 58, 91, 204]) {
      const network = buildNetwork(makeConfig({ seed }));
      const solutions = solve(network).solutions();
      expect(solutions.length, `seed=${seed}`).toBeGreaterThan(0);
      for (let i = 1; i < solutions.length; i++) {
        expect(solutions[i].toll, `seed=${seed}`).toBeLessThan(
          solutions[i - 1].toll
        );
      }
    }
  });
});

describe('加权和拿不到凹处的解', () => {
  it('默认这张图上确实存在拿不到的解', () => {
    const solutions = solve(buildNetwork(makeConfig())).solutions();
    expect(solutions.filter(item => !item.supported).length).toBeGreaterThan(0);
  });

  it('扫遍 λ，选中的永远是凸包角点', () => {
    const network = buildNetwork(makeConfig());
    const solutions = solve(network).solutions();
    for (const lambda of LAMBDAS) {
      const picked = solutions[pickByLambda(solutions, lambda)];
      expect(picked.supported, `λ=${lambda}`).toBe(true);
    }
  });

  it('每个角点都有属于自己的一段 λ', () => {
    const network = buildNetwork(makeConfig());
    const solutions = solve(network).solutions();
    const reachable = new Set(
      LAMBDAS.map(lambda => pickByLambda(solutions, lambda))
    );
    solutions.forEach((solution, index) => {
      expect(reachable.has(index), `解 ${index}`).toBe(solution.supported);
    });
  });

  it('加权和 Dijkstra 给的就是前沿里加权和最小的那个', () => {
    const network = buildNetwork(makeConfig());
    const solutions = solve(network).solutions();
    for (const lambda of [0.1, 0.25, 0.5, 0.75, 0.9]) {
      const route = weightedRoute(
        network,
        lambda,
        network.source,
        network.target
      );
      const picked = solutions[pickByLambda(solutions, lambda)];
      expect(route, `λ=${lambda}`).not.toBeNull();
      expect(lambda * route!.time + (1 - lambda) * route!.toll).toBeCloseTo(
        lambda * picked.time + (1 - lambda) * picked.toll
      );
    }
  });
});

describe('hullCorners', () => {
  it('凸的点列全是角点', () => {
    expect(
      hullCorners([
        { time: 10, toll: 50 },
        { time: 20, toll: 20 },
        { time: 30, toll: 0 },
      ])
    ).toEqual([0, 1, 2]);
  });

  it('凹处的点被弹出去', () => {
    expect(
      hullCorners([
        { time: 10, toll: 50 },
        { time: 20, toll: 45 },
        { time: 30, toll: 0 },
      ])
    ).toEqual([0, 2]);
  });

  it('正好躺在连线上的点不算角点 —— 那种解只是并列', () => {
    expect(
      hullCorners([
        { time: 10, toll: 40 },
        { time: 20, toll: 20 },
        { time: 30, toll: 0 },
      ])
    ).toEqual([0, 2]);
  });

  it('端点永远在', () => {
    expect(hullCorners([{ time: 5, toll: 5 }])).toEqual([0]);
    expect(
      hullCorners([
        { time: 1, toll: 9 },
        { time: 9, toll: 1 },
      ])
    ).toEqual([0, 1]);
  });
});
