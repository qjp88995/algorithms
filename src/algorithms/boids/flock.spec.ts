import { describe, expect, it } from 'vitest';

import { defaultConfig, speciesPresets } from './constants';
import { Flock } from './flock';
import type { BoidsConfig, Steering } from './types';

/** 可重复的伪随机数，保证测试确定性 */
function seededRandom(seed = 1) {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 0x100000000;
  };
}

function makeConfig(patch: Partial<BoidsConfig> = {}): BoidsConfig {
  return { ...defaultConfig, ...patch };
}

function emptySteering(): Steering {
  return { sepX: 0, sepY: 0, aliX: 0, aliY: 0, cohX: 0, cohY: 0, neighbors: 0 };
}

/** 手动摆放个体，绕开随机初始化 */
function place(flock: Flock, boids: [number, number, number, number][]) {
  flock.setCount(boids.length);
  boids.forEach(([x, y, vx, vy], i) => {
    flock.x[i] = x;
    flock.y[i] = y;
    flock.vx[i] = vx;
    flock.vy[i] = vy;
  });
}

describe('Flock', () => {
  it('setCount 增加时保留已有个体', () => {
    const flock = new Flock({
      width: 400,
      height: 400,
      count: 3,
      random: seededRandom(),
    });
    const snapshot = [flock.x[0], flock.y[0], flock.vx[0]];

    flock.setCount(10);

    expect(flock.count).toBe(10);
    expect([flock.x[0], flock.y[0], flock.vx[0]]).toEqual(snapshot);
  });

  it('setCount 不会超过容量', () => {
    const flock = new Flock({
      width: 200,
      height: 200,
      count: 5,
      capacity: 8,
      random: seededRandom(),
    });
    flock.setCount(100);
    expect(flock.count).toBe(8);
  });

  it('wrap 模式下位置始终留在画布内', () => {
    const flock = new Flock({
      width: 300,
      height: 200,
      count: 60,
      random: seededRandom(7),
    });
    const config = makeConfig({ count: 60, edgeMode: 'wrap', maxSpeed: 300 });

    for (let i = 0; i < 200; i++) flock.step(1 / 60, config);

    for (let i = 0; i < flock.count; i++) {
      expect(flock.x[i]).toBeGreaterThanOrEqual(0);
      expect(flock.x[i]).toBeLessThanOrEqual(300);
      expect(flock.y[i]).toBeGreaterThanOrEqual(0);
      expect(flock.y[i]).toBeLessThanOrEqual(200);
    }
  });

  it('速度被限制在 [minSpeed, maxSpeed] 内', () => {
    const flock = new Flock({
      width: 400,
      height: 400,
      count: 80,
      random: seededRandom(3),
    });
    const config = makeConfig({ count: 80, minSpeed: 50, maxSpeed: 120 });

    for (let i = 0; i < 120; i++) flock.step(1 / 60, config);

    for (let i = 0; i < flock.count; i++) {
      const speed = Math.hypot(flock.vx[i], flock.vy[i]);
      expect(speed).toBeGreaterThanOrEqual(50 - 1e-3);
      expect(speed).toBeLessThanOrEqual(120 + 1e-3);
    }
  });

  it('分离力把过近的个体推开', () => {
    const flock = new Flock({ width: 400, height: 400, count: 0 });
    // 两只鸟同向并排，间距远小于分离半径
    place(flock, [
      [200, 200, 100, 0],
      [206, 200, 100, 0],
    ]);
    const config = makeConfig({
      count: 2,
      fieldOfView: 360,
      separationRadius: 30,
    });

    const s = flock.computeSteering(0, config, emptySteering());

    expect(s.neighbors).toBe(1);
    // 0 号在左，分离力应指向左（-x）
    expect(s.sepX).toBeLessThan(0);
  });

  it('对齐力把速度拉向邻居方向', () => {
    const flock = new Flock({ width: 400, height: 400, count: 0 });
    // 0 号向右飞，邻居向上飞，且距离大于分离半径
    place(flock, [
      [200, 200, 100, 0],
      [240, 200, 0, 100],
    ]);
    const config = makeConfig({
      count: 2,
      fieldOfView: 360,
      separationRadius: 10,
      perceptionRadius: 80,
    });

    const s = flock.computeSteering(0, config, emptySteering());

    expect(s.neighbors).toBe(1);
    expect(s.aliY).toBeGreaterThan(0); // 被拉向 +y
  });

  it('聚合力指向邻居重心', () => {
    const flock = new Flock({ width: 400, height: 400, count: 0 });
    place(flock, [
      [200, 200, 0, -100],
      [200, 250, 0, -100],
      [210, 250, 0, -100],
    ]);
    const config = makeConfig({
      count: 3,
      fieldOfView: 360,
      separationRadius: 5,
      perceptionRadius: 100,
    });

    const s = flock.computeSteering(0, config, emptySteering());

    expect(s.neighbors).toBe(2);
    expect(s.cohY).toBeGreaterThan(0); // 重心在下方
  });

  it('视野角度会挡住身后的邻居', () => {
    const flock = new Flock({ width: 400, height: 400, count: 0 });
    // 邻居正在 0 号身后
    place(flock, [
      [200, 200, 100, 0],
      [160, 200, 100, 0],
    ]);
    const narrow = makeConfig({ count: 2, fieldOfView: 120 });
    const full = makeConfig({ count: 2, fieldOfView: 360 });

    expect(flock.computeSteering(0, narrow, emptySteering()).neighbors).toBe(0);
    expect(flock.computeSteering(0, full, emptySteering()).neighbors).toBe(1);
  });

  it('同向飞行时极化度接近 1，随机方向时接近 0', () => {
    const aligned = new Flock({ width: 400, height: 400, count: 0 });
    place(aligned, [
      [10, 10, 100, 0],
      [40, 10, 100, 0],
      [70, 10, 100, 0],
    ]);
    expect(aligned.metrics().polarization).toBeCloseTo(1, 5);

    const opposed = new Flock({ width: 400, height: 400, count: 0 });
    place(opposed, [
      [10, 10, 100, 0],
      [40, 10, -100, 0],
    ]);
    expect(opposed.metrics().polarization).toBeCloseTo(0, 5);
  });

  it('长时间运行不会产生 NaN', () => {
    const flock = new Flock({
      width: 320,
      height: 240,
      count: 200,
      random: seededRandom(11),
    });
    const config = makeConfig({ count: 200, edgeMode: 'bounce' });

    for (let i = 0; i < 400; i++) flock.step(1 / 60, config);

    for (let i = 0; i < flock.count; i++) {
      expect(Number.isFinite(flock.x[i])).toBe(true);
      expect(Number.isFinite(flock.y[i])).toBe(true);
      expect(Number.isFinite(flock.vx[i])).toBe(true);
      expect(Number.isFinite(flock.vy[i])).toBe(true);
    }
  });

  it('网格查询与朴素 O(n²) 查询给出相同的邻居集合', () => {
    const flock = new Flock({
      width: 500,
      height: 400,
      count: 150,
      random: seededRandom(5),
    });
    const config = makeConfig({
      count: 150,
      fieldOfView: 360,
      perceptionRadius: 50,
    });
    flock.step(1 / 60, config);

    const naive = (i: number) => {
      const result: number[] = [];
      for (let j = 0; j < flock.count; j++) {
        if (j === i) continue;
        const d2 =
          (flock.x[j] - flock.x[i]) ** 2 + (flock.y[j] - flock.y[i]) ** 2;
        if (d2 > 0 && d2 <= config.perceptionRadius ** 2) result.push(j);
      }
      return result;
    };

    for (const i of [0, 17, 63, 149]) {
      expect([...flock.neighborsOf(i, config)].sort((a, b) => a - b)).toEqual(
        naive(i)
      );
    }
  });

  describe('拓扑感知', () => {
    const topological = (patch: Partial<BoidsConfig> = {}) =>
      makeConfig({
        perception: 'topological',
        neighborCount: 5,
        fieldOfView: 360,
        ...patch,
      });

    it('固定取最近的 k 个邻居，多出来的一概不看', () => {
      const flock = new Flock({ width: 400, height: 400, count: 0 });
      // 一排等距排开的同伴，全都在视野里
      place(flock, [
        [200, 200, 100, 0],
        [210, 200, 100, 0],
        [220, 200, 100, 0],
        [230, 200, 100, 0],
        [240, 200, 100, 0],
        [250, 200, 100, 0],
        [260, 200, 100, 0],
        [270, 200, 100, 0],
      ]);

      const config = topological({ count: 8, neighborCount: 3 });
      expect(flock.computeSteering(0, config, emptySteering()).neighbors).toBe(
        3
      );
      // 取到的必须是最近的三个，而不是任意三个
      expect(flock.neighborsOf(0, config).sort((a, b) => a - b)).toEqual([
        1, 2, 3,
      ]);
    });

    it('邻居不够 k 个时有多少算多少', () => {
      const flock = new Flock({ width: 400, height: 400, count: 0 });
      place(flock, [
        [200, 200, 100, 0],
        [210, 200, 100, 0],
      ]);
      const config = topological({ count: 2, neighborCount: 7 });
      expect(flock.computeSteering(0, config, emptySteering()).neighbors).toBe(
        1
      );
    });

    it('同伴远在视野半径之外也照样能找到 —— 这正是拓扑的意义', () => {
      const flock = new Flock({ width: 900, height: 900, count: 0 });
      // 间距 260px，远大于任何合理的视野半径
      place(flock, [
        [100, 100, 100, 0],
        [360, 100, 100, 0],
        [620, 100, 100, 0],
      ]);

      const metric = makeConfig({
        count: 3,
        fieldOfView: 360,
        perceptionRadius: 60,
      });
      expect(flock.computeSteering(0, metric, emptySteering()).neighbors).toBe(
        0
      );

      const config = topological({
        count: 3,
        neighborCount: 2,
        perceptionRadius: 60,
      });
      expect(flock.computeSteering(0, config, emptySteering()).neighbors).toBe(
        2
      );
    });

    it('群体被拉稀疏后，度量模式邻居归零而拓扑模式不变', () => {
      const spread = (gap: number) => {
        const flock = new Flock({ width: 2000, height: 600, count: 0 });
        const boids: [number, number, number, number][] = [];
        for (let i = 0; i < 12; i++) boids.push([100 + i * gap, 300, 100, 0]);
        place(flock, boids);
        return flock;
      };

      const metric = makeConfig({
        count: 12,
        fieldOfView: 360,
        perceptionRadius: 60,
      });
      const topo = topological({ count: 12, neighborCount: 4 });

      const dense = spread(30);
      const sparse = spread(150);

      expect(dense.computeSteering(5, metric, emptySteering()).neighbors).toBe(
        4
      );
      expect(sparse.computeSteering(5, metric, emptySteering()).neighbors).toBe(
        0
      );
      // 拓扑模式下密度变化对邻居数毫无影响
      expect(dense.computeSteering(5, topo, emptySteering()).neighbors).toBe(4);
      expect(sparse.computeSteering(5, topo, emptySteering()).neighbors).toBe(
        4
      );
    });

    it('视野角在拓扑模式下依然生效', () => {
      const flock = new Flock({ width: 400, height: 400, count: 0 });
      place(flock, [
        [200, 200, 100, 0],
        [160, 200, 100, 0],
      ]);
      const blind = topological({
        count: 2,
        neighborCount: 5,
        fieldOfView: 120,
      });
      expect(flock.computeSteering(0, blind, emptySteering()).neighbors).toBe(
        0
      );
    });

    it('拓扑模式长时间运行不会产生 NaN', () => {
      const flock = new Flock({
        width: 320,
        height: 240,
        count: 150,
        random: seededRandom(21),
      });
      const config = topological({ count: 150 });
      for (let i = 0; i < 300; i++) flock.step(1 / 60, config);

      for (let i = 0; i < flock.count; i++) {
        expect(Number.isFinite(flock.x[i])).toBe(true);
        expect(Number.isFinite(flock.vx[i])).toBe(true);
      }
    });
  });

  describe('捕食者', () => {
    /** 把一群鸟摆成密集团块，捕食者压在正中间 */
    const makeSwarm = (mode: 'repel' | 'predator') => {
      const flock = new Flock({ width: 600, height: 600, count: 0 });
      const boids: [number, number, number, number][] = [];
      for (let i = 0; i < 24; i++) {
        const angle = (i / 24) * Math.PI * 2;
        boids.push([
          300 + Math.cos(angle) * 40,
          300 + Math.sin(angle) * 40,
          Math.cos(angle) * 60,
          Math.sin(angle) * 60,
        ]);
      }
      place(flock, boids);
      const config = makeConfig({
        count: 24,
        fieldOfView: 360,
        pointer: {
          active: true,
          x: 300,
          y: 300,
          mode,
          radius: 160,
          strength: 1.4,
        },
      });
      return { flock, config };
    };

    const meanRadius = (flock: Flock) => {
      let sum = 0;
      for (let i = 0; i < flock.count; i++) {
        sum += Math.hypot(flock.x[i] - 300, flock.y[i] - 300);
      }
      return sum / flock.count;
    };

    it('捕食者比普通驱散推得更开', () => {
      const repel = makeSwarm('repel');
      const predator = makeSwarm('predator');
      for (let i = 0; i < 30; i++) {
        repel.flock.step(1 / 60, repel.config);
        predator.flock.step(1 / 60, predator.config);
      }
      expect(meanRadius(predator.flock)).toBeGreaterThan(
        meanRadius(repel.flock)
      );
    });

    it('恐慌会放大聚合力，这是饵球和喷泉效应的来源', () => {
      // 直接量不好取，于是测它的可观测后果：如果捕食者确实放大了聚合，
      // 那么"有没有聚合"对散开程度的影响，在捕食者模式下应该比
      // 普通驱散更明显。
      const spreadAfter = (
        mode: 'repel' | 'predator',
        cohesionWeight: number
      ) => {
        const { flock, config } = makeSwarm(mode);
        const tuned = { ...config, cohesionWeight };
        for (let i = 0; i < 40; i++) flock.step(1 / 60, tuned);
        return meanRadius(flock);
      };

      const repelGap = spreadAfter('repel', 0) - spreadAfter('repel', 1.2);
      const predatorGap =
        spreadAfter('predator', 0) - spreadAfter('predator', 1.2);

      expect(repelGap).toBeGreaterThan(0);
      expect(predatorGap).toBeGreaterThan(repelGap);
    });
  });

  describe('物种预设', () => {
    it('椋鸟群用拓扑感知，沙丁鱼群用度量感知', () => {
      const starling = speciesPresets.find(item => item.id === 'starling')!;
      const sardine = speciesPresets.find(item => item.id === 'sardine')!;

      expect(starling.patch.perception).toBe('topological');
      expect(sardine.patch.perception).toBe('metric');
      // 鸟必须保持最低速度（失速），鱼可以近乎悬停
      expect(starling.patch.minSpeed!).toBeGreaterThan(sardine.patch.minSpeed!);
      // 鱼靠侧线，近场无盲区
      expect(sardine.patch.fieldOfView).toBe(360);
      expect(starling.patch.fieldOfView!).toBeLessThan(360);
    });

    it('两个物种预设都能稳定跑起来', () => {
      for (const preset of speciesPresets) {
        const flock = new Flock({
          width: 400,
          height: 300,
          count: 120,
          random: seededRandom(5),
        });
        const config = makeConfig({ count: 120, ...preset.patch });
        for (let i = 0; i < 200; i++) flock.step(1 / 60, config);

        for (let i = 0; i < flock.count; i++) {
          expect(Number.isFinite(flock.x[i]), preset.id).toBe(true);
          expect(Number.isFinite(flock.vx[i]), preset.id).toBe(true);
        }
      }
    });
  });
});
