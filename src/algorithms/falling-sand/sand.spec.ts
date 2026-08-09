import { describe, expect, it } from 'vitest';

import {
  EMPTY,
  FIRE,
  LAVA,
  OIL,
  SAND,
  STEAM,
  STONE,
  WATER,
  WOOD,
} from './materials';
import { CHUNK, SandWorld } from './sand';
import type { SandOptions } from './types';

const DEFAULTS: SandOptions = {
  useChunks: true,
  alternateScan: true,
  bottomUp: true,
};

function options(patch: Partial<SandOptions> = {}): SandOptions {
  return { ...DEFAULTS, ...patch };
}

function run(world: SandWorld, frames: number, patch?: Partial<SandOptions>) {
  const opts = options(patch);
  for (let k = 0; k < frames; k++) world.step(opts);
}

/** 数一列上某种材质最靠上的那一格，没有就返回 -1 */
function topOf(world: SandWorld, id: number, column: number) {
  for (let y = 0; y < world.rows; y++) {
    if (world.get(column, y) === id) return y;
  }
  return -1;
}

function count(world: SandWorld, id: number) {
  let total = 0;
  for (let i = 0; i < world.mat.length; i++) {
    if (world.mat[i] === id) total++;
  }
  return total;
}

/** 铺一层地板，免得东西掉出画布 */
function withFloor(cols: number, rows: number, seed = 7) {
  const world = new SandWorld(cols, rows, seed);
  for (let x = 0; x < cols; x++) world.set(x, rows - 1, STONE);
  return world;
}

/**
 * 一根竖管里装五格沙。加两堵墙是为了堵掉「斜着滑走」这条路 ——
 * 只剩正下方可走，一帧的位移才只反映扫描顺序本身。
 */
function sandColumn() {
  const world = withFloor(8, 20);
  for (let y = 0; y < 19; y++) {
    world.set(3, y, STONE);
    world.set(5, y, STONE);
  }
  for (let y = 2; y < 7; y++) world.set(4, y, SAND);
  return world;
}

describe('粉末', () => {
  it('一帧掉一格 —— 自底向上扫的全部意义就在这', () => {
    const world = withFloor(8, 20);
    world.set(4, 2, SAND);

    world.step(options());
    expect(world.get(4, 2)).toBe(EMPTY);
    expect(world.get(4, 3)).toBe(SAND);

    world.step(options());
    expect(world.get(4, 4)).toBe(SAND);
  });

  it('自底向上扫：一柱沙整体下移一格', () => {
    const world = sandColumn();

    world.step(options());
    expect(world.get(4, 2)).toBe(EMPTY);
    for (let y = 3; y < 8; y++) expect(world.get(4, y)).toBe(SAND);
  });

  it('自顶向下扫：同一柱沙只从底下漏出一粒，上面纹丝不动', () => {
    const world = sandColumn();

    world.step(options({ bottomUp: false }));
    // 先处理的是最上面那粒，而它下面是沙 —— 走不了。
    // 于是整柱卡住，只有最底下那粒漏进空格，柱子被从下面一格一格拆散
    expect(world.get(4, 2)).toBe(SAND);
    expect(world.get(4, 7)).toBe(SAND);
    expect(world.get(4, 6)).toBe(EMPTY);
  });

  it('落到底就停住，而且一粒都不会丢', () => {
    const world = withFloor(8, 16);
    for (let y = 1; y < 6; y++) world.set(4, y, SAND);
    run(world, 200);

    expect(count(world, SAND)).toBe(5);
    // 五粒沙堆在地板上，最高不会超过五格
    expect(topOf(world, SAND, 4)).toBeGreaterThanOrEqual(world.rows - 6);
  });

  it('堆成锥形：一柱沙自己会向两边塌', () => {
    const world = withFloor(21, 30);
    for (let y = 0; y < 24; y++) world.set(10, y, SAND);
    run(world, 400);

    // 塌下来之后不再是一根柱子，底部铺开的宽度远大于 1
    let width = 0;
    for (let x = 0; x < world.cols; x++) {
      if (world.get(x, world.rows - 2) === SAND) width++;
    }
    expect(width).toBeGreaterThan(5);
    expect(count(world, SAND)).toBe(24);
  });
});

describe('密度分层', () => {
  it('沙沉到水底，水被挤上来', () => {
    const world = withFloor(6, 16);
    for (let y = 8; y < 15; y++) {
      for (let x = 0; x < 6; x++) world.set(x, y, WATER);
    }
    world.set(3, 2, SAND);
    run(world, 300);

    const sandY = topOf(world, SAND, 3);
    expect(sandY).toBe(world.rows - 2);
    // 沙上面那一格重新被水占回去了
    expect(world.get(3, sandY - 1)).toBe(WATER);
  });

  it('油浮在水上 —— 表里没有任何一条规则写着这件事', () => {
    const world = withFloor(12, 20);
    // 故意反着放：油在下、水在上
    for (let y = 10; y < 15; y++) {
      for (let x = 1; x < 11; x++) world.set(x, y, OIL);
    }
    for (let y = 5; y < 10; y++) {
      for (let x = 1; x < 11; x++) world.set(x, y, WATER);
    }
    run(world, 600);

    let oilSum = 0;
    let oilCount = 0;
    let waterSum = 0;
    let waterCount = 0;
    for (let y = 0; y < world.rows; y++) {
      for (let x = 0; x < world.cols; x++) {
        if (world.get(x, y) === OIL) {
          oilSum += y;
          oilCount++;
        } else if (world.get(x, y) === WATER) {
          waterSum += y;
          waterCount++;
        }
      }
    }
    // 两者的重心对调了：油整体跑到了水上面
    expect(oilSum / oilCount).toBeLessThan(waterSum / waterCount);
  });

  it('水会自己找平', () => {
    const world = withFloor(40, 20);
    for (let y = 2; y < 19; y++) {
      for (let x = 0; x < 4; x++) world.set(x, y, WATER);
    }
    run(world, 400);

    // 一柱水塌下来铺满整个底部，没有压强求解，只靠一格一格挤
    let bottom = 0;
    for (let x = 0; x < world.cols; x++) {
      if (world.get(x, world.rows - 2) === WATER) bottom++;
    }
    expect(bottom).toBeGreaterThan(30);
  });

  it('气体往上跑', () => {
    const world = withFloor(8, 24);
    world.set(4, 20, STEAM);
    run(world, 60);
    expect(topOf(world, STEAM, 4)).toBeLessThan(20);
  });
});

describe('反应', () => {
  it('岩浆把踩着的木头点着，火再沿着木头烧过去', () => {
    const world = withFloor(16, 12);
    for (let x = 0; x < 16; x++) world.set(x, 10, WOOD);
    world.set(8, 9, LAVA);
    run(world, 1200);

    // 接触点先着，火自己是可燃物的点火源，于是烧穿一片而不止一格
    expect(count(world, WOOD)).toBeLessThan(12);
  });

  it('水浇岩浆：一边凝成石头，一边变蒸汽', () => {
    const world = withFloor(10, 12);
    for (let x = 2; x < 8; x++) world.set(x, 9, LAVA);
    for (let x = 2; x < 8; x++) world.set(x, 8, WATER);
    run(world, 200);

    expect(count(world, STONE)).toBeGreaterThan(10); // 地板 10 格之外还多出了石头
    expect(count(world, LAVA)).toBeLessThan(6);
  });

  it('水能灭火', () => {
    const world = withFloor(10, 12);
    world.set(4, 9, WATER);
    world.set(4, 8, FIRE);
    run(world, 40);
    expect(count(world, FIRE)).toBe(0);
  });

  it('蒸汽活够了就凝回水 —— 这套系统真的会下雨', () => {
    const world = withFloor(6, 40);
    world.set(3, 38, STEAM);
    run(world, 400);
    expect(count(world, STEAM)).toBe(0);
    expect(count(world, WATER)).toBe(1);
  });
});

describe('脏块', () => {
  it('全静止之后活跃块归零，扫过的像素也归零', () => {
    const world = withFloor(64, 64);
    for (let x = 10; x < 20; x++) {
      for (let y = 10; y < 20; y++) world.set(x, y, SAND);
    }
    run(world, 400);

    const stats = world.stats();
    expect(stats.activeChunks).toBe(0);
    expect(stats.scanned).toBe(0);
  });

  it('碰一下就能把睡着的块叫醒', () => {
    const world = withFloor(64, 64);
    for (let x = 10; x < 20; x++) {
      for (let y = 10; y < 20; y++) world.set(x, y, SAND);
    }
    run(world, 400);
    expect(world.stats().activeChunks).toBe(0);

    world.set(15, 40, SAND);
    world.step(options());
    expect(world.stats().activeChunks).toBeGreaterThan(0);
  });

  it('沙子跨块下落时不会卡在块边界上', () => {
    const world = withFloor(32, 64);
    // 正好落在块边界上方一格
    world.set(8, CHUNK - 1, SAND);
    run(world, 300);
    expect(topOf(world, SAND, 8)).toBe(world.rows - 2);
  });

  it('关掉 chunk 优化就是每帧全屏扫', () => {
    const world = withFloor(64, 64);
    world.set(30, 5, SAND);
    run(world, 5, { useChunks: false });

    const stats = world.stats();
    expect(stats.scanned).toBe(world.cols * world.rows);
    expect(stats.activeChunks).toBe(stats.totalChunks);
  });

  it('开着 chunk 时，扫的量远小于整屏', () => {
    const world = withFloor(64, 64);
    world.set(30, 5, SAND);
    run(world, 5);
    expect(world.stats().scanned).toBeLessThan((world.cols * world.rows) / 4);
  });
});

describe('扫描方向', () => {
  it('固定方向扫，沙堆会整体朝一侧漂', () => {
    const drift = (alternateScan: boolean) => {
      const world = withFloor(81, 40);
      for (let y = 0; y < 30; y++) {
        for (let x = 38; x < 43; x++) world.set(x, y, SAND);
      }
      run(world, 600, { alternateScan });

      let sum = 0;
      let total = 0;
      for (let y = 0; y < world.rows; y++) {
        for (let x = 0; x < world.cols; x++) {
          if (world.get(x, y) === SAND) {
            sum += x;
            total++;
          }
        }
      }
      return Math.abs(sum / total - 40);
    };

    expect(drift(false)).toBeGreaterThan(drift(true));
  });
});

describe('尺寸变化', () => {
  it('画布变大时内容留在原地', () => {
    const world = withFloor(16, 16);
    world.set(3, 3, SAND);
    world.resize(32, 32);
    expect(world.get(3, 3)).toBe(SAND);
    expect(world.filled).toBe(17); // 16 格地板 + 1 粒沙
  });

  it('画布变小时超出的部分被丢掉，计数跟着更新', () => {
    const world = new SandWorld(16, 16, 3);
    world.set(3, 3, SAND);
    world.set(12, 12, SAND);
    world.resize(8, 8);
    expect(world.get(3, 3)).toBe(SAND);
    expect(world.filled).toBe(1);
  });
});
