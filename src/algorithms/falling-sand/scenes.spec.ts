import { describe, expect, it } from 'vitest';

import { LAVA, OIL, SAND, STEAM, STONE, WATER } from './materials';
import { SandWorld } from './sand';
import { findScene, scenes } from './scenes';
import type { SandOptions } from './types';

const OPTIONS: SandOptions = {
  useChunks: true,
  alternateScan: true,
  bottomUp: true,
};

function build(id: string, cols = 160, rows = 110) {
  const world = new SandWorld(cols, rows, 20_250_809);
  findScene(id)!.build(world);
  return world;
}

function run(world: SandWorld, frames: number) {
  for (let k = 0; k < frames; k++) world.step(OPTIONS);
}

function count(world: SandWorld, id: number) {
  let total = 0;
  for (let i = 0; i < world.mat.length; i++) {
    if (world.mat[i] === id) total++;
  }
  return total;
}

/** 某种材质的竖直重心，没有就返回 NaN */
function centroidY(world: SandWorld, id: number) {
  let sum = 0;
  let total = 0;
  for (let y = 0; y < world.rows; y++) {
    for (let x = 0; x < world.cols; x++) {
      if (world.get(x, y) === id) {
        sum += y;
        total++;
      }
    }
  }
  return total === 0 ? Number.NaN : sum / total;
}

/** 数下面这一段里有多少格是这种材质 */
function countBelow(world: SandWorld, id: number, fromRatio: number) {
  let total = 0;
  for (let y = Math.floor(world.rows * fromRatio); y < world.rows; y++) {
    for (let x = 0; x < world.cols; x++) {
      if (world.get(x, y) === id) total++;
    }
  }
  return total;
}

describe('场景摆放', () => {
  it.each(scenes.map(scene => scene.id))(
    '「%s」在窄画布和宽画布上都摆得出东西，而且跑得起来',
    id => {
      for (const [cols, rows] of [
        [48, 40],
        [160, 110],
        [420, 260],
      ]) {
        const world = build(id, cols, rows);
        expect(world.filled).toBeGreaterThan(0);
        run(world, 200);
      }
    }
  );
});

describe('沙漏', () => {
  it('沙一开始全在颈口以上，跑一阵后漏到下面堆成一摊', () => {
    const world = build('hourglass');
    expect(countBelow(world, SAND, 0.75)).toBe(0);

    run(world, 1500);
    const settled = countBelow(world, SAND, 0.75);
    expect(settled).toBeGreaterThan(100);

    // 底下堆开的宽度远大于颈口 —— 沙不是笔直落成一根柱子
    let width = 0;
    for (let x = 0; x < world.cols; x++) {
      if (world.get(x, world.rows - 4) === SAND) width++;
    }
    expect(width).toBeGreaterThan(12);
  });
});

describe('油水分层', () => {
  it('油被放在水下面，跑一阵之后自己翻上来', () => {
    const world = build('layers');
    expect(centroidY(world, OIL)).toBeGreaterThan(centroidY(world, WATER));

    run(world, 2000);
    expect(centroidY(world, OIL)).toBeLessThan(centroidY(world, WATER));
  });
});

describe('火山', () => {
  it('岩浆漏下去、烧穿木头、掉进水里凝成石头并激起蒸汽', () => {
    const world = build('volcano');
    const stoneBefore = count(world, STONE);
    expect(count(world, LAVA)).toBeGreaterThan(0);

    run(world, 3000);

    expect(count(world, STONE)).toBeGreaterThan(stoneBefore);
    expect(count(world, STEAM)).toBeGreaterThan(0);
  });
});

describe('空场地', () => {
  it('只有石头，别的什么都没有', () => {
    const world = build('sandbox');
    expect(count(world, STONE)).toBe(world.filled);
  });
});
