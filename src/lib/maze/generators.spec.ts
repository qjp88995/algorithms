import { describe, expect, it } from 'vitest';

import { createGenerator, MARK_ACTIVE, type MazeAlgorithm } from './generators';
import {
  cellCount,
  cellNeighbors,
  countDeadEnds,
  createMazeGrid,
  eachCell,
  type MazeGrid,
  wallBetween,
} from './grid';

function seededRandom(seed = 1) {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 0x100000000;
  };
}

const algorithms: MazeAlgorithm[] = [
  'backtracker',
  'prim',
  'kruskal',
  'wilson',
];

function build(algorithm: MazeAlgorithm, seed = 1, cols = 21, rows = 13) {
  const grid = createMazeGrid(cols, rows);
  const generator = createGenerator(algorithm, grid, seededRandom(seed));
  generator.runToEnd();
  return { grid, generator };
}

/** 数打通了多少堵墙 —— 生成树的边数 */
function openWalls(grid: MazeGrid) {
  const buffer = new Int32Array(4);
  let total = 0;
  eachCell(grid, index => {
    const count = cellNeighbors(grid, index, buffer);
    for (let i = 0; i < count; i++) {
      if (buffer[i] <= index) continue;
      if (grid.walls[wallBetween(grid, index, buffer[i])] === 0) total++;
    }
  });
  return total;
}

/** 从第一个通道格泛洪，返回能走到的通道格数 */
function reachableCells(grid: MazeGrid) {
  const cells: number[] = [];
  eachCell(grid, index => cells.push(index));
  const start = cells.find(index => grid.walls[index] === 0);
  if (start === undefined) return 0;

  const seen = new Set<number>([start]);
  const queue = [start];
  const buffer = new Int32Array(4);
  while (queue.length > 0) {
    const current = queue.pop()!;
    const count = cellNeighbors(grid, current, buffer);
    for (let i = 0; i < count; i++) {
      const next = buffer[i];
      if (seen.has(next)) continue;
      if (grid.walls[next] === 1) continue;
      if (grid.walls[wallBetween(grid, current, next)] === 1) continue;
      seen.add(next);
      queue.push(next);
    }
  }
  return seen.size;
}

describe('迷宫生成', () => {
  it('四种算法都把每个通道格并进来', () => {
    for (const algorithm of algorithms) {
      const { grid, generator } = build(algorithm);
      const stats = generator.stats();
      expect(stats.done, algorithm).toBe(true);
      expect(stats.carved, algorithm).toBe(cellCount(grid));
    }
  });

  // 完美迷宫 = 生成树：连通、无环。边数恰好是点数减一时，
  // 连通就蕴含无环 —— 两条一起查才说明白。
  it('产物都是完美迷宫：连通且无环', () => {
    for (const algorithm of algorithms) {
      for (let seed = 1; seed <= 3; seed++) {
        const { grid } = build(algorithm, seed);
        const cells = cellCount(grid);
        expect(reachableCells(grid), `${algorithm} seed ${seed}`).toBe(cells);
        expect(openWalls(grid), `${algorithm} seed ${seed}`).toBe(cells - 1);
      }
    }
  });

  it('同一个种子生成同一个迷宫', () => {
    for (const algorithm of algorithms) {
      const a = build(algorithm, 7).grid;
      const b = build(algorithm, 7).grid;
      expect([...a.walls], algorithm).toEqual([...b.walls]);
    }
  });

  it('单步走完和一次跑完结果一样', () => {
    for (const algorithm of algorithms) {
      const { grid: whole } = build(algorithm, 5);

      const grid = createMazeGrid(21, 13);
      const generator = createGenerator(algorithm, grid, seededRandom(5));
      let guard = 0;
      while (!generator.done && guard++ < 4_000_000) generator.step();

      expect([...grid.walls], algorithm).toEqual([...whole.walls]);
    }
  });

  it('跑完之后不留活跃标记，游标也收起来', () => {
    for (const algorithm of algorithms) {
      const { generator } = build(algorithm);
      expect(generator.cursor, algorithm).toBe(-1);
      expect([...generator.mark].includes(MARK_ACTIVE), algorithm).toBe(false);
    }
  });

  // 这一条正是这个页面想说的事：四种算法产物同构，手感却不同。
  // 递归回溯总是走到底再回头，长走廊多、岔口少；Prim 每次从整圈边界
  // 随机挑一个，四面同时长，岔口密、死胡同多。
  it('递归回溯的死胡同明显比 Prim 少', () => {
    for (let seed = 1; seed <= 3; seed++) {
      const deep = countDeadEnds(build('backtracker', seed, 31, 21).grid);
      const spread = countDeadEnds(build('prim', seed, 31, 21).grid);
      expect(deep, `seed ${seed}`).toBeLessThan(spread);
    }
  });

  // Wilson 为均匀性付出的代价：绝大部分步数走的是后来被抹掉的环
  it('Wilson 的步数远高于它并入的格数', () => {
    const { generator } = build('wilson', 3, 31, 21);
    const stats = generator.stats();
    expect(stats.steps).toBeGreaterThan(stats.carved * 3);
  });

  it('只有 Kruskal 报告多个连通分量', () => {
    const { grid, generator } = build('kruskal', 2);
    expect(generator.showsComponents).toBe(true);

    // 跑到一半时应该是好几块各自长大的斑块
    const half = createMazeGrid(21, 13);
    const running = createGenerator('kruskal', half, seededRandom(2));
    running.advance(Math.floor(cellCount(half) / 2));
    const roots = new Set<number>();
    eachCell(half, index => roots.add(running.componentOf(index)));
    expect(roots.size).toBeGreaterThan(1);

    // 跑完就并成一块了
    const finalRoots = new Set<number>();
    eachCell(grid, index => finalRoots.add(generator.componentOf(index)));
    expect(finalRoots.size).toBe(1);
  });
});
