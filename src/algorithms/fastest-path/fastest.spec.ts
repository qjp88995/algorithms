import { describe, expect, it } from 'vitest';

import {
  DAY,
  defaultConfig,
  MORNING_PEAK,
  ROADWORK_OPEN_AT,
} from './constants';
import { FastestPathRun } from './fastest';
import {
  arriveVia,
  bestArrival,
  buildNetwork,
  congestion,
  departureFor,
  formatClock,
  phaseOf,
  type RoadNetwork,
  simulate,
  travelTime,
} from './network';
import type { FastestConfig } from './types';

function makeConfig(patch: Partial<FastestConfig> = {}): FastestConfig {
  return { ...defaultConfig, ...patch };
}

function solve(network: RoadNetwork, departure: number) {
  const run = new FastestPathRun(
    network,
    network.source,
    network.target,
    departure
  );
  run.runToEnd();
  return run;
}

/** 一天里每隔 30 分钟取一个出发时刻 */
const DEPARTURES = Array.from({ length: 48 }, (_, i) => i * 30);

describe('路况模型', () => {
  it('高峰时段比深夜慢，畅通时两者一样', () => {
    const network = buildNetwork(makeConfig());
    const peak = travelTime(network, 0, MORNING_PEAK);
    const night = travelTime(network, 0, 3 * 60);
    expect(peak).toBeGreaterThan(night);

    const calm = buildNetwork(makeConfig({ rush: 0 }));
    expect(travelTime(calm, 0, MORNING_PEAK)).toBeCloseTo(
      travelTime(calm, 0, 3 * 60)
    );
    expect(congestion(calm, 0, MORNING_PEAK)).toBe(0);
  });

  it('拥堵按天循环', () => {
    const network = buildNetwork(makeConfig());
    expect(congestion(network, 0, MORNING_PEAK)).toBeCloseTo(
      congestion(network, 0, MORNING_PEAK + DAY)
    );
    expect(phaseOf(-30)).toBe(DAY - 30);
  });

  it('潮汐拥堵本身满足 FIFO —— 晚出发绝不会早到', () => {
    const network = buildNetwork(makeConfig({ rush: 3 }));
    for (let edge = 0; edge < network.graph.edges.length; edge += 7) {
      for (let time = 0; time < DAY; time += 10) {
        const now = time + travelTime(network, edge, time);
        const later = time + 10 + travelTime(network, edge, time + 10);
        expect(later, `edge=${edge} t=${time}`).toBeGreaterThanOrEqual(
          now - 1e-9
        );
      }
    }
  });

  it('施工路段打破 FIFO：卡着放行时刻出发反而早到', () => {
    const network = buildNetwork(makeConfig({ roadwork: true }));
    expect(network.roadworks.length).toBe(2);
    const edge = network.roadworks[0];

    const early = ROADWORK_OPEN_AT - 5;
    const onTime = ROADWORK_OPEN_AT;
    expect(early + travelTime(network, edge, early)).toBeGreaterThan(
      onTime + travelTime(network, edge, onTime)
    );
  });

  it('允许等待时，封路前出发会等到放行；不允许时只能硬闯', () => {
    const patient = buildNetwork(makeConfig({ roadwork: true, waiting: true }));
    const edge = patient.roadworks[0];
    const time = ROADWORK_OPEN_AT - 20;
    expect(departureFor(patient, edge, time)).toBe(ROADWORK_OPEN_AT);
    expect(arriveVia(patient, edge, time)).toBeLessThan(
      time + travelTime(patient, edge, time)
    );

    const impatient = buildNetwork(makeConfig({ roadwork: true }));
    expect(departureFor(impatient, impatient.roadworks[0], time)).toBe(time);
  });

  it('等太久就不划算了，那就直接走', () => {
    const patient = buildNetwork(makeConfig({ roadwork: true, waiting: true }));
    const edge = patient.roadworks[0];
    // 半夜出发，等到 9 点要几个小时，远不如直接付那 90 分钟
    expect(departureFor(patient, edge, 60)).toBe(60);
  });

  it('simulate 逐段累加，最后一项就是到达时刻', () => {
    const network = buildNetwork(makeConfig());
    const run = solve(network, 7 * 60);
    const path = run.path();
    const times = simulate(network, path, 7 * 60);
    expect(times).toHaveLength(path.length);
    expect(times[0]).toBe(7 * 60);
    for (let i = 1; i < times.length; i++) {
      expect(times[i]).toBeGreaterThan(times[i - 1]);
    }
  });
});

describe('FastestPathRun', () => {
  it('FIFO 成立时，Dijkstra 就是最优 —— 全天任意时刻出发都一样', () => {
    const network = buildNetwork(makeConfig({ rush: 2 }));
    for (const departure of DEPARTURES) {
      const run = solve(network, departure);
      const stats = run.stats();
      expect(stats.reached, `t=${departure}`).toBe(true);
      expect(stats.lateBy, `t=${departure}`).toBe(0);
      expect(run.betterPath(), `t=${departure}`).toEqual([]);
    }
  });

  it('路况全天畅通时，时间依赖最优退化成静态最短路', () => {
    const network = buildNetwork(makeConfig({ rush: 0 }));
    const run = solve(network, 7 * 60);
    const stats = run.stats();
    expect(stats.sameRoute).toBe(true);
    expect(stats.arrival).toBeCloseTo(stats.staticArrival);
  });

  it('高峰期按自由流时间选路会吃亏', () => {
    const network = buildNetwork(makeConfig({ rush: 2.5 }));
    const late = DEPARTURES.map(departure => {
      const stats = solve(network, departure).stats();
      return stats.staticArrival - stats.arrival;
    });
    // 至少存在一个出发时刻，静态路线实际更晚到
    expect(Math.max(...late)).toBeGreaterThan(0);
    // 而且永远不会更早：Dijkstra 算的就是最早到达
    expect(Math.min(...late)).toBeGreaterThanOrEqual(-1e-9);
  });

  it('施工破坏 FIFO 之后，Dijkstra 会给出不是最优的答案', () => {
    const network = buildNetwork(makeConfig({ roadwork: true }));
    // 违例窗口很窄：必须"差一点就能赶在放行前到路口"，
    // 所以只在早高峰前后按 5 分钟细扫
    const late = [];
    for (let departure = 6 * 60; departure <= 10 * 60; departure += 5) {
      late.push(solve(network, departure).stats().lateBy);
    }
    expect(Math.max(...late)).toBeGreaterThan(10);
  });

  it('允许等待就把 FIFO 补回来了，Dijkstra 重新变对', () => {
    const network = buildNetwork(makeConfig({ roadwork: true, waiting: true }));
    for (const departure of DEPARTURES) {
      expect(solve(network, departure).stats().lateBy, `t=${departure}`).toBe(
        0
      );
    }
  });

  it('单步累加起来和一口气跑到底是同一个结果', () => {
    const network = buildNetwork(makeConfig({ nodeCount: 12 }));
    const stepwise = new FastestPathRun(
      network,
      network.source,
      network.target,
      8 * 60
    );
    let guard = 0;
    while (!stepwise.step() && guard++ < 100000);
    const batch = solve(network, 8 * 60);
    expect([...stepwise.arrival]).toEqual([...batch.arrival]);
    expect(stepwise.stats().checks).toBe(batch.stats().checks);
  });

  it('到达时刻单调地写在路径上，且与统计一致', () => {
    const network = buildNetwork(makeConfig());
    const run = solve(network, 7 * 60);
    const times = run.times();
    const stats = run.stats();
    expect(times[times.length - 1]).toBeCloseTo(stats.arrival);
    expect(stats.duration).toBeCloseTo(stats.arrival - 7 * 60);
  });

  it('多标签搜索在 FIFO 下和 Dijkstra 结果一致', () => {
    const network = buildNetwork(makeConfig({ seed: 9, rush: 1.8 }));
    for (const departure of [0, 300, 480, 600, 1080, 1380]) {
      const run = solve(network, departure);
      const best = bestArrival(
        network,
        network.source,
        network.target,
        departure
      );
      expect(best.arrival, `t=${departure}`).toBeCloseTo(
        run.stats().arrival,
        6
      );
    }
  });
});

describe('formatClock', () => {
  it('补零并折回一天之内', () => {
    expect(formatClock(0)).toBe('00:00');
    expect(formatClock(9 * 60 + 5)).toBe('09:05');
    expect(formatClock(DAY + 65)).toBe('01:05');
  });
});
