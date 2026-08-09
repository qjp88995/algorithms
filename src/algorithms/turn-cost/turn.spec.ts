import { describe, expect, it } from 'vitest';

import { defaultConfig } from './constants';
import { buildGrid, dirBetween, stepTo, turnPenalty } from './grid';
import { evaluate, naivePath, stepsFirstPath, TurnRun } from './turn';
import type { Dir, TurnConfig, TurnCosts, TurnGrid } from './types';

function makeConfig(patch: Partial<TurnConfig> = {}): TurnConfig {
  return { ...defaultConfig, ...patch };
}

function costsOf(config: TurnConfig): TurnCosts {
  return { turn: config.turnCost, uTurn: config.uTurnCost };
}

function solve(config: TurnConfig) {
  const grid = buildGrid(config);
  const run = new TurnRun(grid, costsOf(config), config.startDir);
  run.runToEnd();
  return { grid, run };
}

/** 一张没有任何障碍的空场地 */
function emptyGrid(cols: number, rows: number): TurnGrid {
  return {
    cols,
    rows,
    walls: new Uint8Array(cols * rows),
    start: cols + 1,
    goal: (rows - 2) * cols + (cols - 2),
  };
}

describe('转弯代价', () => {
  const costs: TurnCosts = { turn: 3, uTurn: 6 };

  it('直行免费，转弯要钱，掉头最贵', () => {
    expect(turnPenalty(0, 0, costs)).toBe(0);
    expect(turnPenalty(0, 1, costs)).toBe(3);
    expect(turnPenalty(0, 3, costs)).toBe(3);
    expect(turnPenalty(0, 2, costs)).toBe(6);
  });

  it('左转右转一个价，方向绕回来也认得出', () => {
    expect(turnPenalty(3, 0, costs)).toBe(3);
    expect(turnPenalty(0, 3, costs)).toBe(turnPenalty(3, 0, costs));
  });
});

describe('网格', () => {
  it('起终点连通，且四周留出空地', () => {
    const grid = buildGrid(makeConfig());
    expect(grid.walls[grid.start]).toBe(0);
    expect(grid.walls[grid.goal]).toBe(0);
    const run = new TurnRun(grid, { turn: 1, uTurn: 2 }, 0);
    run.runToEnd();
    expect(run.found).toBe(true);
  });

  it('撞墙和出界都走不通', () => {
    const grid = emptyGrid(6, 5);
    expect(stepTo(grid, grid.start, 3)).toBe(1);
    expect(stepTo(grid, 1, 3)).toBe(-1);
    grid.walls[grid.start + 1] = 1;
    expect(stepTo(grid, grid.start, 0)).toBe(-1);
  });

  it('dirBetween 认得四个方向', () => {
    const grid = emptyGrid(6, 5);
    const cell = 2 * 6 + 2;
    expect(dirBetween(grid, cell, cell + 1)).toBe(0);
    expect(dirBetween(grid, cell, cell + 6)).toBe(1);
    expect(dirBetween(grid, cell, cell - 1)).toBe(2);
    expect(dirBetween(grid, cell, cell - 6)).toBe(3);
  });
});

describe('TurnRun', () => {
  it('空场地上最优就是一条 L —— 只转一次弯', () => {
    const grid = emptyGrid(12, 9);
    const run = new TurnRun(grid, { turn: 3, uTurn: 6 }, 0);
    run.runToEnd();

    const bill = evaluate(grid, run.path(), 0, { turn: 3, uTurn: 6 });
    expect(run.found).toBe(true);
    expect(bill.steps).toBe(9 + 6);
    expect(bill.turns).toBe(1);
    expect(bill.uTurns).toBe(0);
    expect(bill.cost).toBe(15 + 3);
  });

  it('出发朝向不对就得先付一次转弯', () => {
    const grid = emptyGrid(12, 9);
    const costs: TurnCosts = { turn: 3, uTurn: 6 };
    const facingRight = new TurnRun(grid, costs, 0);
    const facingUp = new TurnRun(grid, costs, 3);
    facingRight.runToEnd();
    facingUp.runToEnd();

    // 朝上出发：要么先右转要么先左转，总之躲不掉，比朝右出发贵一次转弯
    expect(evaluate(grid, facingUp.path(), 3, costs).cost).toBe(
      evaluate(grid, facingRight.path(), 0, costs).cost + 3
    );
  });

  it('转弯不要钱时退化成普通最短路', () => {
    const grid = buildGrid(makeConfig());
    const run = new TurnRun(grid, { turn: 0, uTurn: 0 }, 0);
    run.runToEnd();
    const bill = evaluate(grid, run.path(), 0, { turn: 0, uTurn: 0 });
    expect(bill.cost).toBe(bill.steps);

    const stepsFirst = stepsFirstPath(grid, { turn: 0, uTurn: 0 }, 0);
    expect(bill.steps).toBe(stepsFirst.length - 1);
  });

  it('转弯越贵，最优路线的转弯越少（代价也越高）', () => {
    const grid = buildGrid(makeConfig());
    let previousTurns = Infinity;
    for (const turn of [0, 1, 3, 6]) {
      const costs: TurnCosts = { turn, uTurn: turn * 2 };
      const run = new TurnRun(grid, costs, 0);
      run.runToEnd();
      const bill = evaluate(grid, run.path(), 0, costs);
      expect(bill.turns, `turn=${turn}`).toBeLessThanOrEqual(previousTurns);
      previousTurns = bill.turns;
    }
  });

  it('单步累加起来和一口气跑到底是同一个结果', () => {
    const config = makeConfig({ cols: 20, rows: 14 });
    const grid = buildGrid(config);
    const stepwise = new TurnRun(grid, costsOf(config), config.startDir);
    let guard = 0;
    while (!stepwise.step() && guard++ < 500000);
    const batch = new TurnRun(grid, costsOf(config), config.startDir);
    batch.runToEnd();
    expect(stepwise.path()).toEqual(batch.path());
    expect(stepwise.stats().expanded).toBe(batch.stats().expanded);
  });

  it('状态空间是格子的四倍', () => {
    const config = makeConfig();
    const { grid, run } = solve(config);
    const open = grid.walls.reduce((sum, wall) => sum + (wall ? 0 : 1), 0);
    expect(run.stats().total).toBe(open * 4);
  });
});

describe('两个对照都不如状态空间搜索', () => {
  const SEEDS = [12, 3, 40, 77, 128, 301];

  it('最优就是最优：没有对照能比它更便宜', () => {
    for (const seed of SEEDS) {
      const config = makeConfig({ seed });
      const costs = costsOf(config);
      const { grid, run } = solve(config);
      const best = evaluate(grid, run.path(), config.startDir, costs).cost;

      for (const [name, path] of [
        ['步数优先', run.stepsFirstPath()],
        ['朴素', run.naivePath()],
      ] as const) {
        const bill = evaluate(grid, path, config.startDir, costs);
        expect(bill.cost, `seed=${seed} ${name}`).toBeGreaterThanOrEqual(best);
      }
    }
  });

  it('两个对照给的都是能走通的合法路线', () => {
    for (const seed of SEEDS) {
      const config = makeConfig({ seed });
      const { grid, run } = solve(config);
      for (const path of [run.stepsFirstPath(), run.naivePath()]) {
        expect(path[0], `seed=${seed}`).toBe(grid.start);
        expect(path[path.length - 1], `seed=${seed}`).toBe(grid.goal);
        for (let i = 1; i < path.length; i++) {
          const dir = dirBetween(grid, path[i - 1], path[i]);
          expect(stepTo(grid, path[i - 1], dir as Dir), `seed=${seed}`).toBe(
            path[i]
          );
        }
      }
    }
  });

  it('步数优先的那条步数确实最少，但代价可以更高', () => {
    const config = makeConfig();
    const costs = costsOf(config);
    const { grid, run } = solve(config);
    const best = evaluate(grid, run.path(), config.startDir, costs);
    const stepsFirst = evaluate(
      grid,
      run.stepsFirstPath(),
      config.startDir,
      costs
    );
    expect(stepsFirst.steps).toBeLessThanOrEqual(best.steps);
    expect(stepsFirst.cost).toBeGreaterThan(best.cost);
  });

  it('朴素做法在默认这张图上给出的答案不是最优', () => {
    const config = makeConfig();
    const costs = costsOf(config);
    const { grid, run } = solve(config);
    const best = evaluate(grid, run.path(), config.startDir, costs);
    const naive = evaluate(grid, run.naivePath(), config.startDir, costs);
    expect(naive.cost).toBeGreaterThan(best.cost);
  });

  it('转弯免费时，三条路线的代价一模一样', () => {
    const config = makeConfig({ turnCost: 0, uTurnCost: 0 });
    const costs = costsOf(config);
    const grid = buildGrid(config);
    const run = new TurnRun(grid, costs, config.startDir);
    run.runToEnd();

    const best = evaluate(grid, run.path(), config.startDir, costs);
    for (const path of [
      stepsFirstPath(grid, costs, config.startDir),
      naivePath(grid, costs, config.startDir),
    ]) {
      expect(evaluate(grid, path, config.startDir, costs).cost).toBe(best.cost);
    }
  });
});

describe('evaluate', () => {
  it('数得清直行、转弯和掉头', () => {
    const grid = emptyGrid(8, 6);
    const costs: TurnCosts = { turn: 3, uTurn: 6 };
    const row = 2 * 8;
    // 向右两格，再向下一格：一次转弯
    const path = [row + 1, row + 2, row + 3, row + 8 + 3];
    expect(evaluate(grid, path, 0, costs)).toEqual({
      steps: 3,
      turns: 1,
      uTurns: 0,
      cost: 3 + 3,
    });
    // 同一条路，出发时朝左：开头就得掉头
    expect(evaluate(grid, path, 2, costs)).toEqual({
      steps: 3,
      turns: 1,
      uTurns: 1,
      cost: 3 + 3 + 6,
    });
  });
});
