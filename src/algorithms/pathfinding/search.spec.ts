import { describe, expect, it } from 'vitest';

import { defaultConfig, SWAMP_COST } from './constants';
import {
  createGrid,
  DIAGONAL_COST,
  heuristic,
  indexOf,
  setSwamp,
  setWall,
} from './grid';
import { generateMaze, scatterObstacles } from './maze';
import { PathSearch } from './search';
import {
  type GridModel,
  NODE_CLOSED,
  NODE_OPEN,
  type SearchAlgorithm,
  type SearchConfig,
} from './types';

function seededRandom(seed = 1) {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 0x100000000;
  };
}

function makeConfig(patch: Partial<SearchConfig> = {}): SearchConfig {
  return { ...defaultConfig, ...patch };
}

/** 跑到底并返回结果 */
function solve(grid: GridModel, config: SearchConfig) {
  const search = new PathSearch(grid, config);
  search.runToEnd();
  return { search, stats: search.stats(), path: search.path() };
}

/** 竖一堵中间开口的墙，用来制造必须绕行的地形 */
function buildWallWithGap(grid: GridModel, column: number, gapRow: number) {
  for (let y = 0; y < grid.rows; y++) {
    if (y === gapRow) continue;
    setWall(grid, indexOf(grid, column, y), true);
  }
}

const algorithms: SearchAlgorithm[] = ['astar', 'dijkstra', 'bfs', 'greedy'];

describe('PathSearch', () => {
  it('空网格上四种算法都能找到路径', () => {
    for (const algorithm of algorithms) {
      const grid = createGrid(20, 12);
      const { stats } = solve(grid, makeConfig({ algorithm }));
      expect(stats.found, algorithm).toBe(true);
      expect(stats.done, algorithm).toBe(true);
    }
  });

  it('路径首尾正好是起点和终点，且每一步都相邻', () => {
    const grid = createGrid(20, 12);
    const { path } = solve(grid, makeConfig());

    expect(path[0]).toBe(grid.start);
    expect(path[path.length - 1]).toBe(grid.goal);

    for (let i = 1; i < path.length; i++) {
      const dx = Math.abs((path[i] % grid.cols) - (path[i - 1] % grid.cols));
      const dy = Math.abs(
        Math.floor(path[i] / grid.cols) - Math.floor(path[i - 1] / grid.cols)
      );
      expect(dx + dy).toBe(1); // 四向移动
    }
  });

  it('四向等权网格上，A* 的路径长度等于曼哈顿距离', () => {
    const grid = createGrid(20, 12);
    const { path } = solve(grid, makeConfig({ algorithm: 'astar' }));

    const dx = Math.abs((grid.goal % 20) - (grid.start % 20));
    const dy = Math.abs(
      Math.floor(grid.goal / 20) - Math.floor(grid.start / 20)
    );
    expect(path.length - 1).toBe(dx + dy);
  });

  it('A* 与 Dijkstra 给出等长的最优路径，但 A* 展开的节点更少', () => {
    const makeGrid = () => {
      const grid = createGrid(40, 24);
      buildWallWithGap(grid, 20, 4);
      return grid;
    };

    const astar = solve(makeGrid(), makeConfig({ algorithm: 'astar' }));
    const dijkstra = solve(makeGrid(), makeConfig({ algorithm: 'dijkstra' }));

    expect(astar.stats.found).toBe(true);
    expect(astar.stats.pathCost).toBeCloseTo(dijkstra.stats.pathCost, 6);
    expect(astar.stats.expanded).toBeLessThan(dijkstra.stats.expanded);
  });

  it('零启发式的 A* 与 Dijkstra 展开数量一致', () => {
    const build = () => {
      const grid = createGrid(30, 18);
      buildWallWithGap(grid, 15, 3);
      return grid;
    };
    const zero = solve(
      build(),
      makeConfig({ algorithm: 'astar', heuristic: 'none' })
    );
    const dijkstra = solve(build(), makeConfig({ algorithm: 'dijkstra' }));

    expect(zero.stats.expanded).toBe(dijkstra.stats.expanded);
    expect(zero.stats.pathCost).toBeCloseTo(dijkstra.stats.pathCost, 6);
  });

  it('沼泽地形下 Dijkstra 会绕开，BFS 不看权重因而代价更高', () => {
    const build = () => {
      const grid = createGrid(24, 11);
      // 在起终点之间糊一整片沼泽，只有绕到上下边缘才能避开
      for (let y = 3; y < 8; y++) {
        for (let x = 8; x < 16; x++) setSwamp(grid, indexOf(grid, x, y), true);
      }
      return grid;
    };

    const dijkstra = solve(build(), makeConfig({ algorithm: 'dijkstra' }));
    const bfs = solve(build(), makeConfig({ algorithm: 'bfs' }));

    expect(dijkstra.stats.found).toBe(true);
    expect(bfs.stats.found).toBe(true);
    // BFS 直穿沼泽，格数更少但实际代价更高
    expect(bfs.stats.pathLength).toBeLessThanOrEqual(dijkstra.stats.pathLength);
    expect(bfs.stats.pathCost).toBeGreaterThan(dijkstra.stats.pathCost);
  });

  it('沼泽的代价确实按权重累加', () => {
    const grid = createGrid(8, 3);
    grid.start = indexOf(grid, 0, 1);
    grid.goal = indexOf(grid, 2, 1);
    // 把除了中间一行以外的路全堵死，强制穿过沼泽
    for (let x = 0; x < 8; x++) {
      setWall(grid, indexOf(grid, x, 0), true);
      setWall(grid, indexOf(grid, x, 2), true);
    }
    setSwamp(grid, indexOf(grid, 1, 1), true);

    const { stats } = solve(grid, makeConfig({ algorithm: 'dijkstra' }));
    // 走两步：进沼泽（SWAMP_COST）+ 进终点（1）
    expect(stats.pathCost).toBeCloseTo(SWAMP_COST + 1, 6);
  });

  it('被墙完全隔断时结束但找不到路径', () => {
    const grid = createGrid(20, 12);
    for (let y = 0; y < grid.rows; y++) {
      setWall(grid, indexOf(grid, 10, y), true);
    }

    const { stats, path } = solve(grid, makeConfig());
    expect(stats.done).toBe(true);
    expect(stats.found).toBe(false);
    expect(path).toEqual([]);
  });

  it('允许对角移动时用八方距离，路径比四向更短', () => {
    const build = () => {
      const grid = createGrid(20, 20);
      // 起终点必须错开行列，否则对角走不出任何优势
      grid.start = indexOf(grid, 1, 1);
      grid.goal = indexOf(grid, 16, 16);
      return grid;
    };
    const orthogonal = solve(build(), makeConfig());
    const diagonal = solve(
      build(),
      makeConfig({ allowDiagonal: true, heuristic: 'octile' })
    );

    expect(diagonal.stats.pathCost).toBeLessThan(orthogonal.stats.pathCost);
  });

  it('对角移动不切墙角', () => {
    const grid = createGrid(9, 9);
    grid.start = indexOf(grid, 1, 1);
    grid.goal = indexOf(grid, 3, 3);
    // 在对角线上摆一个直角，斜穿会正好从两堵墙中间挤过去
    setWall(grid, indexOf(grid, 2, 1), true);
    setWall(grid, indexOf(grid, 1, 2), true);

    const { path } = solve(
      grid,
      makeConfig({ allowDiagonal: true, heuristic: 'octile' })
    );
    // 起点被两堵墙夹住，唯一出路是先走 (2,2) 的对角
    expect(path).not.toContain(indexOf(grid, 2, 1));
    expect(path).not.toContain(indexOf(grid, 1, 2));
    for (let i = 1; i < path.length; i++) {
      expect(path[i]).not.toBe(path[i - 1]);
    }
  });

  it('贪心最佳优先展开更少，但会直穿沼泽给出更贵的路径', () => {
    const build = () => {
      const grid = createGrid(24, 11);
      // 起终点之间糊一片沼泽：可以走，但很贵
      for (let y = 3; y < 8; y++) {
        for (let x = 8; x < 16; x++) setSwamp(grid, indexOf(grid, x, y), true);
      }
      return grid;
    };

    const greedy = solve(build(), makeConfig({ algorithm: 'greedy' }));
    const astar = solve(build(), makeConfig({ algorithm: 'astar' }));

    expect(greedy.stats.found).toBe(true);
    // 贪心只看到终点的估计距离，一头扎进沼泽
    expect(greedy.stats.expanded).toBeLessThan(astar.stats.expanded);
    expect(greedy.stats.pathCost).toBeGreaterThan(astar.stats.pathCost);
  });

  it('凹形陷阱只让贪心多展开节点，回溯出的路径仍是最优的', () => {
    // 值得单独记一笔：贪心扎进死胡同浪费的是展开数，那段冤枉路
    // 并不在 cameFrom 链上，所以最终路径未必更长。
    const build = () => {
      const grid = createGrid(40, 21);
      for (let y = 5; y <= 15; y++) setWall(grid, indexOf(grid, 22, y), true);
      for (let x = 12; x <= 22; x++) {
        setWall(grid, indexOf(grid, x, 5), true);
        setWall(grid, indexOf(grid, x, 15), true);
      }
      return grid;
    };

    const greedy = solve(build(), makeConfig({ algorithm: 'greedy' }));
    const astar = solve(build(), makeConfig({ algorithm: 'astar' }));

    expect(greedy.stats.expanded).toBeLessThan(astar.stats.expanded);
    expect(greedy.stats.pathCost).toBeCloseTo(astar.stats.pathCost, 6);
  });

  it('加权 A* 展开更少，代价不低于标准 A*', () => {
    const build = () => {
      const grid = createGrid(40, 24);
      buildWallWithGap(grid, 20, 20);
      return grid;
    };
    const exact = solve(build(), makeConfig({ heuristicWeight: 1 }));
    const weighted = solve(build(), makeConfig({ heuristicWeight: 3 }));

    expect(weighted.stats.expanded).toBeLessThanOrEqual(exact.stats.expanded);
    expect(weighted.stats.pathCost).toBeGreaterThanOrEqual(
      exact.stats.pathCost - 1e-6
    );
  });

  it('单步执行与一次跑完的结果一致', () => {
    const grid = createGrid(30, 18);
    buildWallWithGap(grid, 15, 6);

    const stepped = new PathSearch(grid, makeConfig());
    let guard = 0;
    while (!stepped.done && guard++ < 10000) stepped.step();

    const direct = solve(grid, makeConfig());
    expect(stepped.path()).toEqual(direct.path);
    expect(stepped.stats().expanded).toBe(direct.stats.expanded);
  });

  it('展开顺序是连续编号，可用于波前着色', () => {
    const grid = createGrid(16, 10);
    const { search, stats } = solve(grid, makeConfig());

    const orders = [...search.order]
      .filter(value => value >= 0)
      .sort((a, b) => a - b);
    expect(orders.length).toBe(stats.expanded);
    expect(orders).toEqual(orders.map((_, index) => index));
  });

  // 下面这组是渲染要用的东西：边界的亮度画的就是 key，
  // 游标画的就是 expanding。画错了看起来只是"颜色怪"，很难发现，所以钉住。
  it('key 记的是入队时的排序键：Dijkstra 下等于 g', () => {
    const grid = createGrid(20, 12);
    const search = new PathSearch(grid, makeConfig({ algorithm: 'dijkstra' }));
    search.advance(40);

    let checked = 0;
    for (let i = 0; i < search.state.length; i++) {
      if (search.state[i] !== NODE_OPEN) continue;
      expect(search.key[i]).toBeCloseTo(search.gScore[i], 6);
      checked++;
    }
    expect(checked).toBeGreaterThan(0);
  });

  it('key 记的是入队时的排序键：贪心下等于 h', () => {
    const grid = createGrid(20, 12);
    const config = makeConfig({ algorithm: 'greedy' });
    const search = new PathSearch(grid, config);
    search.advance(40);

    let checked = 0;
    for (let i = 0; i < search.state.length; i++) {
      if (search.state[i] !== NODE_OPEN) continue;
      expect(search.key[i]).toBeCloseTo(
        heuristic(grid, i, grid.goal, config.heuristic),
        6
      );
      checked++;
    }
    expect(checked).toBeGreaterThan(0);
  });

  it('弹出的总是边界里 key 最小的那个', () => {
    const grid = createGrid(20, 12);
    scatterObstacles(grid, 0.2, 0.2, seededRandom(7));
    const search = new PathSearch(grid, makeConfig());

    for (let round = 0; round < 30 && !search.done; round++) {
      let best = Infinity;
      for (let i = 0; i < search.state.length; i++) {
        if (search.state[i] === NODE_OPEN && search.key[i] < best) {
          best = search.key[i];
        }
      }
      search.step();
      expect(search.key[search.expanding]).toBeCloseTo(best, 6);
    }
  });

  it('expanding 跟着游标走，第一步展开的是起点', () => {
    const grid = createGrid(20, 12);
    const search = new PathSearch(grid, makeConfig());
    expect(search.expanding).toBe(-1);

    search.step();
    expect(search.expanding).toBe(grid.start);
    expect(search.state[grid.start]).toBe(NODE_CLOSED);
  });

  it('对角代价是 √2 而不是 1', () => {
    const grid = createGrid(5, 5);
    grid.start = indexOf(grid, 1, 1);
    grid.goal = indexOf(grid, 2, 2);

    const { stats } = solve(
      grid,
      makeConfig({ allowDiagonal: true, heuristic: 'octile' })
    );
    expect(stats.pathCost).toBeCloseTo(DIAGONAL_COST, 6);
  });
});

describe('地形生成', () => {
  it('迷宫始终连通：起点一定能走到终点', () => {
    for (let seed = 1; seed <= 5; seed++) {
      const grid = createGrid(31, 21);
      generateMaze(grid, seededRandom(seed));
      const { stats } = solve(grid, makeConfig());
      expect(stats.found, `seed ${seed}`).toBe(true);
    }
  });

  it('迷宫不会把起点或终点埋进墙里', () => {
    const grid = createGrid(31, 21);
    generateMaze(grid, seededRandom(3));
    expect(grid.walls[grid.start]).toBe(0);
    expect(grid.walls[grid.goal]).toBe(0);
  });

  it('随机障碍保留起点和终点', () => {
    const grid = createGrid(30, 20);
    scatterObstacles(grid, 0.9, 0.5, seededRandom(9));
    expect(grid.walls[grid.start]).toBe(0);
    expect(grid.walls[grid.goal]).toBe(0);
    expect(grid.weights[grid.start]).toBe(1);
  });
});
