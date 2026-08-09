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
  liquidSpread: 5,
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

  /**
   * 液面最上头总有一层填不满整格的水。相邻两级只差一格时，
   * 「这边 6 格那边 5 格」和「这边 5 格那边 6 格」在能量上完全等价 ——
   * 没有任何局部规则推得动它们，只能靠同高度的随机游走摊匀。
   * 少了那一步，水面会永久卡成一级级一格高的台阶。
   */
  it('一边深一边浅，最后会摊成同一个高度', () => {
    const world = withFloor(60, 20);
    const floor = 19;
    for (let y = floor - 8; y < floor; y++) {
      for (let x = 1; x < 30; x++) world.set(x, y, WATER);
    }
    for (let y = floor - 2; y < floor; y++) {
      for (let x = 30; x < 59; x++) world.set(x, y, WATER);
    }

    run(world, 3000);

    // 每一列的水深最多差一格 —— 那一格是离散网格的量化误差，抹不掉
    let low = Number.POSITIVE_INFINITY;
    let high = 0;
    for (let x = 1; x < 59; x++) {
      let depth = 0;
      for (let y = 0; y < world.rows; y++) {
        if (world.get(x, y) === WATER) depth++;
      }
      low = Math.min(low, depth);
      high = Math.max(high, depth);
    }
    expect(high - low).toBeLessThanOrEqual(1);
  }, 30_000);

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

  /**
   * 火是气体，本来每帧都在往上飘。木头一着火就整格变成火焰，火苗当帧
   * 升空 —— 燃料还在，点火的人却跑了。所以火贴着燃料时既不飘也不老化，
   * 否则一根木条永远只烧穿火源正上方那一小段。
   */
  it('火沿着一根长木条一路烧过去，不是只烧穿火源头顶那一段', () => {
    const world = new SandWorld(120, 30, 9);
    for (let y = 10; y < 13; y++) {
      for (let x = 5; x < 105; x++) world.set(x, y, WOOD);
    }
    // 左端底下垫一撮火：气体往上飘，会被木条挡住，贴着烧
    for (let y = 13; y < 16; y++) {
      for (let x = 5; x < 12; x++) world.set(x, y, FIRE);
    }
    const before = count(world, WOOD);

    run(world, 2000);
    expect(count(world, WOOD)).toBeLessThan(before * 0.4);
    // 最远那一端也烧到了
    expect(world.get(100, 11)).not.toBe(WOOD);
  });

  it('烧完就该灭：四周没燃料了，火照常老化消失', () => {
    const world = withFloor(20, 20);
    world.set(10, 15, FIRE);
    run(world, 200);
    expect(count(world, FIRE)).toBe(0);
  });

  it('水浇岩浆：一边凝成石头，一边变蒸汽', () => {
    const world = withFloor(10, 12);
    for (let x = 2; x < 8; x++) world.set(x, 9, LAVA);
    for (let x = 2; x < 8; x++) world.set(x, 8, WATER);
    run(world, 200);

    expect(count(world, STONE)).toBeGreaterThan(10); // 地板 10 格之外还多出了石头
    expect(count(world, LAVA)).toBeLessThan(6);
  });

  /**
   * 淬火概率定的是宏观形态，不只是「多久反应一次」：凝固发生在接触面，
   * 而石头挡水，所以凝得越快，岩浆越早给自己糊出一层隔热壳。0.35 时整坨
   * 卡在水面上，还把两成岩浆永久封在壳里；0.08 时才真的沉得下去。
   */
  it('岩浆落进深水池是边沉边凝，不是卡在水面上结壳', () => {
    const world = new SandWorld(48, 56, 3);
    const surface = 30;
    const floor = 53;
    for (let x = 0; x < 48; x++) {
      for (let y = floor; y < 56; y++) world.set(x, y, STONE);
    }
    for (let y = 0; y < 56; y++) {
      world.set(0, y, STONE);
      world.set(47, y, STONE);
    }
    for (let y = surface; y < floor; y++) {
      for (let x = 1; x < 47; x++) world.set(x, y, WATER);
    }
    const liquid = count(world, WATER);
    for (let y = 8; y < 18; y++) {
      for (let x = 18; x < 30; x++) world.set(x, y, LAVA);
    }
    const lava = count(world, LAVA);

    run(world, 4000);

    // 几乎全凝了 —— 没有一坨被自己的壳封在里面
    expect(count(world, LAVA)).toBeLessThan(lava * 0.1);

    // 而且是一路凝到水面下去的
    let deepest = 0;
    for (let y = 0; y < floor; y++) {
      for (let x = 1; x < 47; x++) {
        if (world.get(x, y) === STONE) deepest = Math.max(deepest, y);
      }
    }
    expect(deepest).toBeGreaterThan(surface + 6);

    // 水一格不少：被烧成蒸汽的那部分升到顶上又凝回来了
    expect(count(world, WATER) + count(world, STEAM)).toBe(liquid);
  }, 30_000);

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

describe('笔刷', () => {
  it('拿火刷石墙不会把墙吃掉 —— 石头不在反应表里，也不该被笔刷抹掉', () => {
    const world = withFloor(24, 24);
    for (let y = 8; y < 16; y++) {
      for (let x = 8; x < 16; x++) world.set(x, y, STONE);
    }
    const before = count(world, STONE);

    world.paint(12, 12, 5, FIRE);
    expect(count(world, STONE)).toBe(before);
    // 火只落在墙外那一圈空格里
    expect(count(world, FIRE)).toBeGreaterThan(0);
  });

  it('流体只落在空格里，不会凭空吃掉沙堆', () => {
    const world = withFloor(24, 24);
    for (let y = 14; y < 22; y++) {
      for (let x = 8; x < 16; x++) world.set(x, y, SAND);
    }
    const before = count(world, SAND);

    world.paint(12, 18, 6, WATER);
    expect(count(world, SAND)).toBe(before);
  });

  it('不动的固体可以直接盖上去 —— 要在水里隔一道挡板', () => {
    const world = withFloor(24, 24);
    for (let y = 10; y < 22; y++) {
      for (let x = 2; x < 22; x++) world.set(x, y, WATER);
    }

    world.paint(12, 16, 3, STONE);
    expect(count(world, STONE)).toBeGreaterThan(world.cols); // 地板之外多出了挡板
  });

  it('橡皮擦一切', () => {
    const world = withFloor(24, 24);
    for (let y = 8; y < 16; y++) {
      for (let x = 8; x < 16; x++) world.set(x, y, STONE);
    }
    world.paint(12, 12, 4, EMPTY);
    expect(world.get(12, 12)).toBe(EMPTY);
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
    // 光是「块醒着」不算数，得真的动起来
    expect(world.stats().moved).toBeGreaterThan(0);
  });

  /**
   * 睡了奇数帧和偶数帧都要能醒。
   *
   * 这两个参数不是凑数：`clock` 曾经存的是帧的**奇偶**，于是一个块睡够
   * 偶数帧之后被叫醒时，格子里的旧值恰好等于当前奇偶，整块被当成
   * 「本帧已处理」跳过 —— 没有变动，块立刻又睡死。挖开的水坑会永远空着。
   */
  it.each([[120], [121]])('静置 %i 帧的水，挖开之后照样会流', frames => {
    const world = withFloor(80, 48);
    for (let y = 20; y < 47; y++) {
      for (let x = 0; x < 80; x++) world.set(x, y, WATER);
    }
    run(world, frames);
    expect(world.stats().activeChunks).toBe(0); // 确认真的睡透了

    const before = count(world, WATER);
    for (let y = 20; y < 40; y++) {
      for (let x = 64; x < 80; x++) world.set(x, y, EMPTY);
    }
    const dug = count(world, WATER);

    world.step(options());
    // 紧挨着坑的水第一帧就该塌进去
    expect(world.stats().moved).toBeGreaterThan(0);

    run(world, 200);
    expect(count(world, WATER)).toBe(dug); // 一格没多没少
    expect(dug).toBeLessThan(before);
    // 凹陷一路传到最左端：那里的水面也跟着降了
    expect(topOf(world, WATER, 2)).toBeGreaterThan(20);
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
    // 世界要够大才说明问题：一粒沙会叫醒周围一圈共九个块，
    // 在只有十六个块的小世界里那就是大半屏了
    const world = withFloor(256, 256);
    world.set(100, 5, SAND);
    run(world, 5);
    expect(world.stats().scanned).toBeLessThan((world.cols * world.rows) / 20);
  });

  /**
   * 这一条守的是脏块跳过的**全部意义**：它只该省时间，不该改结果。
   *
   * 违反它的 bug 极难查 —— 画面上看是液面卡成一道阶梯、挖开的坑不再
   * 填平，而你一关掉脏块跳过它立刻又流起来。根子在于规则的作用半径
   * 超过了唤醒能传播的半径：远处出现了落点，这边那格水却没人叫醒。
   */
  it('开着脏块跳过达到的静止，关掉之后也依然静止', () => {
    const world = withFloor(120, 60);
    // 中间一道墙，左边堆沙、右边一池齐平的水 —— 两样都会真正停下来。
    // （水面不齐平时会永远微微游走，那是液面本来的样子，见下一条）
    for (let y = 0; y < 59; y++) world.set(60, y, STONE);
    for (let y = 20; y < 59; y++) {
      for (let x = 1; x < 40; x++) world.set(x, y, SAND);
    }
    // 水要一路填到画布边上：留一列空的，水就会往那儿淌，
    // 水面永远齐不了平，也就永远静不下来
    for (let y = 30; y < 59; y++) {
      for (let x = 61; x < 120; x++) world.set(x, y, WATER);
    }
    run(world, 1500);
    expect(world.stats().activeChunks).toBe(0);

    // 全屏扫一遍，看有没有谁本该动却被漏掉
    world.step(options({ useChunks: false }));
    expect(world.stats().scanned).toBe(world.cols * world.rows);
    expect(world.stats().moved).toBe(0);
  }, 30_000);
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
