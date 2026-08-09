import { describe, expect, it } from 'vitest';

import {
  classify,
  CycleDetector,
  formatRule,
  LifeGrid,
  parseRule,
} from './life';
import { findPattern, patterns } from './patterns';

const LIFE = parseRule('B3/S23');

/** 把网格画成字符串，断言失败时能直接看出形状 */
function draw(grid: LifeGrid) {
  const lines: string[] = [];
  for (let y = 0; y < grid.rows; y++) {
    let line = '';
    for (let x = 0; x < grid.cols; x++) line += grid.get(x, y) ? 'O' : '.';
    lines.push(line);
  }
  return lines.join('\n');
}

function fromLines(lines: string[]) {
  const grid = new LifeGrid(lines[0].length, lines.length);
  lines.forEach((line, y) => {
    [...line].forEach((char, x) => grid.set(x, y, char === 'O'));
  });
  return grid;
}

describe('规则记号', () => {
  it('B/S 记号和位掩码可以来回转换', () => {
    expect(parseRule('B3/S23')).toEqual({ birth: 0b1000, survive: 0b1100 });
    expect(formatRule(parseRule('B36/S23'))).toBe('B36/S23');
    expect(formatRule(parseRule('B3/S012345678'))).toBe('B3/S012345678');
  });

  it('存活集合可以是空的 —— Seeds 就没有任何细胞活得过一代', () => {
    const rule = parseRule('B2/S');
    expect(rule.survive).toBe(0);
    expect(formatRule(rule)).toBe('B2/S');
  });

  it('认不出来的记号直接报错，而不是悄悄给一条空规则', () => {
    expect(() => parseRule('3/23')).toThrow();
  });
});

describe('LifeGrid 的演化', () => {
  it('闪灯周期 2：横躺一代、竖立一代', () => {
    const grid = fromLines(['.....', '.....', '.OOO.', '.....', '.....']);
    grid.step(LIFE, 'bounded');
    expect(draw(grid)).toBe(
      ['.....', '..O..', '..O..', '..O..', '.....'].join('\n')
    );
    grid.step(LIFE, 'bounded');
    expect(draw(grid)).toBe(
      ['.....', '.....', '.OOO.', '.....', '.....'].join('\n')
    );
  });

  it('方块是静止物：跑一代什么都不变，活跃度为 0', () => {
    const grid = fromLines(['....', '.OO.', '.OO.', '....']);
    grid.step(LIFE, 'bounded');
    expect(draw(grid)).toBe(['....', '.OO.', '.OO.', '....'].join('\n'));
    expect(grid.changed).toBe(0);
    expect(grid.population).toBe(4);
  });

  it('滑翔机四代之后原样平移一格', () => {
    const grid = new LifeGrid(12, 12);
    grid.stamp(findPattern('glider')!, 1, 1);
    const before = draw(grid);
    for (let i = 0; i < 4; i++) grid.step(LIFE, 'bounded');

    const shifted = new LifeGrid(12, 12);
    shifted.stamp(findPattern('glider')!, 2, 2);
    expect(draw(grid)).toBe(draw(shifted));
    expect(draw(grid)).not.toBe(before);
    expect(grid.generation).toBe(4);
  });

  it('人口和活跃度跟着每一代重算', () => {
    const grid = fromLines(['.....', '.....', '.OOO.', '.....', '.....']);
    expect(grid.population).toBe(3);
    grid.step(LIFE, 'bounded');
    // 两端死掉、上下新生，中间那个没动
    expect(grid.population).toBe(3);
    expect(grid.changed).toBe(4);
  });

  it('年龄跨代累加，新生的从 1 开始', () => {
    const grid = fromLines(['....', '.OO.', '.OO.', '....']);
    grid.step(LIFE, 'bounded');
    grid.step(LIFE, 'bounded');
    expect(grid.age[grid.index(1, 1)]).toBe(3);
  });
});

/**
 * 图案库里的坐标是手抄的字符画，抄错一格整个图案就废了 ——
 * 而「废了」在画面上往往只是「看着有点乱」，不会报错。
 * 这几条断言拿它们各自的招牌行为当校验和。
 */
describe('图案库', () => {
  it('滑翔机枪真的在造东西：人口一路往上涨', () => {
    const grid = new LifeGrid(120, 60);
    grid.stamp(findPattern('gosper-gun')!, 2, 2);
    expect(grid.population).toBe(36);

    for (let i = 0; i < 60; i++) grid.step(LIFE, 'bounded');
    const after60 = grid.population;
    for (let i = 0; i < 60; i++) grid.step(LIFE, 'bounded');

    // 每 30 代吐一架滑翔机，一架 5 个细胞；枪本体回到 36
    expect(after60).toBe(36 + 2 * 5);
    expect(grid.population).toBe(36 + 4 * 5);
  });

  it('顽固份子撑到第 130 代，然后一个不剩', () => {
    const grid = new LifeGrid(60, 60);
    grid.stamp(findPattern('diehard')!, 26, 29, 'bounded');
    expect(grid.population).toBe(7);

    for (let i = 0; i < 129; i++) grid.step(LIFE, 'bounded');
    expect(grid.population).toBeGreaterThan(0);
    grid.step(LIFE, 'bounded');
    expect(grid.population).toBe(0);
  });

  it('脉冲星周期 3，三代之后一模一样', () => {
    const grid = new LifeGrid(21, 21);
    grid.stamp(findPattern('pulsar')!, 4, 4, 'bounded');
    const before = draw(grid);
    grid.step(LIFE, 'bounded');
    expect(draw(grid)).not.toBe(before);
    grid.step(LIFE, 'bounded');
    grid.step(LIFE, 'bounded');
    expect(draw(grid)).toBe(before);
  });

  it('每个图案的字符画都只有 O 和 .', () => {
    for (const pattern of patterns) {
      expect(pattern.cells.join('')).toMatch(/^[O.]+$/);
      const width = pattern.cells[0].length;
      for (const line of pattern.cells) expect(line.length).toBe(width);
    }
  });
});

describe('边界模式', () => {
  it('环形边界下贴边的三个细胞照样是闪灯', () => {
    const grid = fromLines(['OOO..', '.....', '.....']);
    grid.step(LIFE, 'torus');
    // 上下相接，于是中间那列的上下都被点亮 —— 竖着的那根穿过了边界
    expect(grid.get(1, 0)).toBe(1);
    expect(grid.get(1, 1)).toBe(1);
    expect(grid.get(1, 2)).toBe(1);
    expect(grid.population).toBe(3);
  });

  it('有界边界下界外恒为死，同一排三个撑不成闪灯', () => {
    const grid = fromLines(['OOO..', '.....', '.....']);
    grid.step(LIFE, 'bounded');
    // 少了上方那一圈邻居，只剩两个细胞，再走一代就全灭
    expect(draw(grid)).toBe(['.O...', '.O...', '.....'].join('\n'));
    grid.step(LIFE, 'bounded');
    expect(grid.population).toBe(0);
  });

  it('图案越过右边界时在环形下绕回来', () => {
    const grid = new LifeGrid(6, 6);
    grid.stamp(findPattern('glider')!, 5, 0, 'torus');
    expect(grid.population).toBe(5);
    expect(grid.get(0, 0)).toBe(1);
  });

  it('有界模式下越界的部分直接丢掉', () => {
    const grid = new LifeGrid(6, 6);
    grid.stamp(findPattern('glider')!, 5, 0, 'bounded');
    expect(grid.population).toBeLessThan(5);
    expect(grid.get(0, 0)).toBe(0);
  });
});

describe('编辑与尺寸', () => {
  it('落笔和擦除都同步维护人口', () => {
    const grid = new LifeGrid(4, 4);
    grid.set(1, 1, true);
    grid.set(1, 1, true);
    expect(grid.population).toBe(1);
    grid.toggle(1, 1);
    expect(grid.population).toBe(0);
  });

  it('越界的落笔被忽略，不会写坏别的行', () => {
    const grid = new LifeGrid(4, 4);
    grid.set(-1, 0, true);
    grid.set(4, 0, true);
    expect(grid.population).toBe(0);
  });

  it('resize 保留重叠区域的内容', () => {
    const grid = fromLines(['OO..', 'O...', '....', '....']);
    grid.resize(8, 6);
    expect(grid.population).toBe(3);
    expect(grid.get(0, 0)).toBe(1);
    expect(grid.get(1, 0)).toBe(1);
    expect(grid.get(0, 1)).toBe(1);
    expect(grid.get(7, 5)).toBe(0);
  });

  it('缩小时被裁掉的部分不再计入人口', () => {
    const grid = fromLines(['O..O', '....', '....', 'O..O']);
    expect(grid.population).toBe(4);
    grid.resize(2, 2);
    expect(grid.population).toBe(1);
  });

  it('随机撒点的密度大致落在设定值附近', () => {
    const grid = new LifeGrid(100, 100);
    let seed = 1;
    grid.randomize(0.3, () => {
      seed = (seed * 1664525 + 1013904223) >>> 0;
      return seed / 0x100000000;
    });
    expect(grid.population / 10000).toBeGreaterThan(0.25);
    expect(grid.population / 10000).toBeLessThan(0.35);
  });
});

describe('周期检测', () => {
  it('闪灯被认成周期 2', () => {
    const grid = fromLines(['.....', '.....', '.OOO.', '.....', '.....']);
    const detector = new CycleDetector(16);
    detector.push(grid.cells, 0, grid.hash());

    grid.step(LIFE, 'bounded');
    expect(detector.push(grid.cells, 1, grid.hash())).toBeNull();
    grid.step(LIFE, 'bounded');
    expect(detector.push(grid.cells, 2, grid.hash())).toBe(2);
  });

  it('滑翔机在有限窗口里不算周期 —— 它每一代都在别的位置', () => {
    const grid = new LifeGrid(20, 20);
    grid.stamp(findPattern('glider')!, 1, 1);
    const detector = new CycleDetector(16);
    for (let gen = 0; gen < 12; gen++) {
      expect(detector.push(grid.cells, gen, grid.hash())).toBeNull();
      grid.step(LIFE, 'bounded');
    }
  });

  it('窗口装不下的周期就测不到 —— 只报观察得到的事实', () => {
    const grid = fromLines(['.....', '.....', '.OOO.', '.....', '.....']);
    const detector = new CycleDetector(1);
    detector.push(grid.cells, 0, grid.hash());
    grid.step(LIFE, 'bounded');
    detector.push(grid.cells, 1, grid.hash());
    grid.step(LIFE, 'bounded');
    // 窗口只装得下一代，第 0 代已经被第 1 代顶掉，周期 2 就此漏掉
    expect(detector.push(grid.cells, 2, grid.hash())).toBeNull();
  });

  it('换了尺寸就重来，不会拿旧格局比新格局', () => {
    const detector = new CycleDetector(8);
    const small = new Uint8Array(4);
    detector.push(small, 0, 1);
    const large = new Uint8Array(16);
    expect(detector.push(large, 1, 1)).toBeNull();
  });
});

describe('状态判定', () => {
  it('人口归零是全灭，没有变化是静止', () => {
    expect(classify(0, 0, null)).toEqual({ kind: 'extinct' });
    expect(classify(10, 0, null)).toEqual({ kind: 'still' });
  });

  it('测到周期就报周期，否则只说还在演化', () => {
    expect(classify(10, 4, 30)).toEqual({ kind: 'cycle', period: 30 });
    expect(classify(10, 4, null)).toEqual({ kind: 'running' });
  });

  it('全灭优先于周期 —— 空画布也满足「和上一代一样」', () => {
    expect(classify(0, 0, 1)).toEqual({ kind: 'extinct' });
  });
});
