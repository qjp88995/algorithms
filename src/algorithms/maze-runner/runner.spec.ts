import { describe, expect, it } from 'vitest';

import { createGenerator } from '@/lib/maze/generators';
import { createMazeGrid, indexOf } from '@/lib/maze/grid';
import { seededRandom } from '@/lib/random';

import { createRunner, type RunnerAlgorithm } from './runner';

const algorithms: RunnerAlgorithm[] = [
  'wall-follower',
  'tremaux',
  'dfs',
  'random',
];

function buildMaze(seed: number, cols = 21, rows = 13) {
  const grid = createMazeGrid(cols, rows);
  createGenerator('backtracker', grid, seededRandom(seed)).runToEnd();
  return {
    grid,
    start: indexOf(grid, 1, 1),
    goal: indexOf(grid, cols - 2, rows - 2),
  };
}

function run(algorithm: RunnerAlgorithm, seed: number, cols = 21, rows = 13) {
  const { grid, start, goal } = buildMaze(seed, cols, rows);
  const runner = createRunner(
    algorithm,
    grid,
    start,
    goal,
    seededRandom(seed * 31 + 7)
  );
  runner.runToEnd();
  return runner;
}

describe('走迷宫', () => {
  it('四种走法都能走出完美迷宫', () => {
    for (const algorithm of algorithms) {
      for (let seed = 1; seed <= 3; seed++) {
        const runner = run(algorithm, seed);
        const stats = runner.stats();
        expect(stats.done, `${algorithm} seed ${seed}`).toBe(true);
        expect(stats.escaped, `${algorithm} seed ${seed}`).toBe(true);
        expect(runner.at, `${algorithm} seed ${seed}`).toBe(runner.goal);
      }
    }
  });

  // 完美迷宫是一棵树。扶墙法等价于沿树做一次欧拉巡游，每条边最多走两次，
  // 所以步数有硬上界 —— 这正是"不用任何记忆也能保证走出去"的代价上限。
  it('扶墙法的步数不超过边数的两倍', () => {
    for (let seed = 1; seed <= 3; seed++) {
      const runner = run('wall-follower', seed);
      const stats = runner.stats();
      expect(stats.steps, `seed ${seed}`).toBeLessThanOrEqual(
        2 * (stats.total - 1)
      );
    }
  });

  // 图搜索里回溯只是弹一下栈，不花钱；这里必须原路走回去。
  // 步数一定多于踏足的格数，多出来的那部分就是回头路。
  it('DFS 的回溯是真的走回去，步数多于踏足格数', () => {
    const stats = run('dfs', 2).stats();
    expect(stats.steps).toBeGreaterThan(stats.visited);
  });

  it('随机游走的步数比 Trémaux 高一个量级', () => {
    for (let seed = 1; seed <= 3; seed++) {
      const wander = run('random', seed).stats();
      const marked = run('tremaux', seed).stats();
      expect(wander.steps, `seed ${seed}`).toBeGreaterThan(marked.steps * 3);
    }
  });

  // 第一人称的要害：走完之后仍然有大片地方没见过。
  // 上帝视角的寻路页不存在这个概念。
  it('只看得见走过的地方和它的四邻', () => {
    const runner = run('wall-follower', 1);
    const stats = runner.stats();

    expect(stats.seen).toBeGreaterThanOrEqual(stats.visited);
    expect(stats.seen).toBeLessThan(runner.grid.walls.length);

    // 每个见过的格子，要么自己被踏过，要么紧挨着一个被踏过的格子
    for (let index = 0; index < runner.seen.length; index++) {
      if (runner.seen[index] === 0) continue;
      if (runner.visits[index] > 0) continue;
      const x = index % runner.grid.cols;
      const y = Math.floor(index / runner.grid.cols);
      const around = [
        [x, y - 1],
        [x + 1, y],
        [x, y + 1],
        [x - 1, y],
      ];
      const touched = around.some(([nx, ny]) => {
        if (nx < 0 || ny < 0) return false;
        if (nx >= runner.grid.cols || ny >= runner.grid.rows) return false;
        return runner.visits[ny * runner.grid.cols + nx] > 0;
      });
      expect(touched, `格子 ${index} 见过却不挨着走过的地方`).toBe(true);
    }
  });

  it('同一个种子走出同一条路', () => {
    for (const algorithm of algorithms) {
      const a = run(algorithm, 4).stats();
      const b = run(algorithm, 4).stats();
      expect(a.steps, algorithm).toBe(b.steps);
      expect(a.visited, algorithm).toBe(b.visited);
    }
  });

  it('单步走完和一次跑完一致', () => {
    for (const algorithm of algorithms) {
      const whole = run(algorithm, 6).stats();

      const { grid, start, goal } = buildMaze(6);
      const runner = createRunner(
        algorithm,
        grid,
        start,
        goal,
        seededRandom(6 * 31 + 7)
      );
      let guard = 0;
      while (!runner.done && guard++ < 2_000_000) runner.step();

      expect(runner.stats().steps, algorithm).toBe(whole.steps);
    }
  });
});
