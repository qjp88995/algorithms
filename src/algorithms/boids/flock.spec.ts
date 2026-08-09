import { describe, expect, it } from 'vitest';

import { defaultConfig } from './constants';
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
});
