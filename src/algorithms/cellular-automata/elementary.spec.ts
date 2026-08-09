import { describe, expect, it } from 'vitest';

import { ElementaryCA, neighborhoodCells, ruleBit } from './elementary';

/** 把时空图画成字符串，一行一代 */
function draw(ca: ElementaryCA) {
  const lines: string[] = [];
  for (let row = 0; row < ca.filled; row++) {
    const offset = ca.offsetOf(row);
    let line = '';
    for (let x = 0; x < ca.width; x++) line += ca.rows[offset + x] ? 'O' : '.';
    lines.push(line);
  }
  return lines.join('\n');
}

/** 用一个受控的「随机源」精确摆出第一行 */
function seedPattern(ca: ElementaryCA, line: string) {
  let cursor = 0;
  ca.seedRandom(0.5, () => (line[cursor++] === 'O' ? 0 : 1));
}

function run(rule: number, width: number, steps: number) {
  const ca = new ElementaryCA(width, steps + 1);
  ca.seedSingle();
  for (let i = 0; i < steps; i++) ca.step(rule);
  return ca;
}

describe('规则编号的读法', () => {
  it('第 n 位就是邻域 n 的输出', () => {
    // 30 = 0b00011110，只有邻域 1、2、3、4 输出 1
    expect([7, 6, 5, 4, 3, 2, 1, 0].map(n => ruleBit(30, n))).toEqual([
      0, 0, 0, 1, 1, 1, 1, 0,
    ]);
  });

  it('邻域编号拆回三个格子', () => {
    expect(neighborhoodCells(7)).toEqual([1, 1, 1]);
    expect(neighborhoodCells(4)).toEqual([1, 0, 0]);
    expect(neighborhoodCells(0)).toEqual([0, 0, 0]);
  });
});

describe('初等 CA 的演化', () => {
  it('Rule 90 从一个细胞长出谢尔宾斯基三角', () => {
    expect(draw(run(90, 9, 3))).toBe(
      ['....O....', '...O.O...', '..O...O..', '.O.O.O.O.'].join('\n')
    );
  });

  it('Rule 30 一边规整一边混沌', () => {
    expect(draw(run(30, 11, 3))).toBe(
      ['.....O.....', '....OOO....', '...OO..O...', '..OO.OOOO..'].join('\n')
    );
  });

  it('Rule 0 一代就全灭，Rule 255 一代就填满', () => {
    expect(run(0, 7, 1).population).toBe(0);
    expect(run(255, 7, 1).population).toBe(7);
  });

  it('Rule 184 是一条马路：前面空着的车才开得动', () => {
    const ca = new ElementaryCA(5, 2);
    seedPattern(ca, '.OO..');
    ca.step(184);
    // 前车往前挪了一格，后车被堵着原地没动
    expect(draw(ca).split('\n')[1]).toBe('.O.O.');
    expect(ca.population).toBe(2);
  });

  it('左右两端相接', () => {
    const ca = new ElementaryCA(5, 3);
    ca.seedSingle();
    // Rule 90 = 左异或右；中心在 2，两代后 0 和 4 应该被点亮
    ca.step(90);
    ca.step(90);
    expect(ca.rows[ca.offsetOf(2)]).toBe(1);
    expect(ca.rows[ca.offsetOf(2) + 4]).toBe(1);
  });
});

describe('时空图的滚动', () => {
  it('行数不超过容量，最老的一行被顶出去', () => {
    const ca = new ElementaryCA(9, 3);
    ca.seedSingle();
    ca.step(90);
    ca.step(90);
    expect(ca.filled).toBe(3);
    expect(draw(ca)).toBe(['....O....', '...O.O...', '..O...O..'].join('\n'));

    ca.step(90);
    expect(ca.filled).toBe(3);
    // 第 0 代滚出画面，最上面变成第 1 代
    expect(draw(ca)).toBe(['...O.O...', '..O...O..', '.O.O.O.O.'].join('\n'));
    expect(ca.generation).toBe(3);
  });

  it('播种会把历史清空', () => {
    const ca = new ElementaryCA(9, 8);
    ca.seedSingle();
    ca.step(90);
    ca.step(90);
    ca.seedSingle();
    expect(ca.filled).toBe(1);
    expect(ca.generation).toBe(0);
    expect(ca.population).toBe(1);
  });

  it('随机播种的密度大致落在设定值附近', () => {
    const ca = new ElementaryCA(1000, 2);
    let seed = 7;
    ca.seedRandom(0.4, () => {
      seed = (seed * 1664525 + 1013904223) >>> 0;
      return seed / 0x100000000;
    });
    expect(ca.population / 1000).toBeGreaterThan(0.35);
    expect(ca.population / 1000).toBeLessThan(0.45);
  });

  it('换宽度就从头开始 —— 旧的行和新的宽度对不齐', () => {
    const ca = new ElementaryCA(9, 4);
    ca.seedSingle();
    ca.step(90);
    ca.resize(15, 4);
    expect(ca.filled).toBe(0);
    expect(ca.width).toBe(15);
    // 下一步会自动补上第一行
    ca.step(90);
    expect(ca.filled).toBe(2);
  });
});
