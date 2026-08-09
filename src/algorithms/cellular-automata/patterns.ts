import type { Pattern } from './types';

/**
 * 图案库。
 *
 * 用 `O` / `.` 的字符画而不是坐标数组 —— 这些图案的价值全在形状上，
 * 源码里直接看得见形状，改错了也一眼能发现。
 *
 * 挑选标准：每一个都对应一句「有限规则能造出什么」。会走的、会震荡的、
 * 会无限造东西的、看着要死其实要爆的 —— 而它们全都跑在同一条 B3/S23 上。
 */
export const patterns: Pattern[] = [
  {
    id: 'glider',
    label: '滑翔机',
    blurb: '最小的会走的东西。四代一个循环，走完斜着挪一格。',
    cells: ['.O.', '..O', 'OOO'],
  },
  {
    id: 'lwss',
    label: '轻量级飞船',
    blurb: '横着走，四代挪两格 —— 比滑翔机快一倍。',
    cells: ['O..O.', '....O', 'O...O', '.OOOO'],
  },
  {
    id: 'pulsar',
    label: '脉冲星',
    blurb: '周期 3 的振荡子。原地喘气，永远不走也永远不停。',
    cells: [
      '..OOO...OOO..',
      '.............',
      'O....O.O....O',
      'O....O.O....O',
      'O....O.O....O',
      '..OOO...OOO..',
      '.............',
      '..OOO...OOO..',
      'O....O.O....O',
      'O....O.O....O',
      'O....O.O....O',
      '.............',
      '..OOO...OOO..',
    ],
  },
  {
    id: 'gosper-gun',
    label: '滑翔机枪',
    blurb:
      '每 30 代吐一架滑翔机，永不停歇。人口无上界 —— 有限的规则可以造出无限。',
    cells: [
      '........................O...........',
      '......................O.O...........',
      '............OO......OO............OO',
      '...........O...O....OO............OO',
      'OO........O.....O...OO..............',
      'OO........O...O.OO....O.O...........',
      '..........O.....O.......O...........',
      '...........O...O....................',
      '............OO......................',
    ],
  },
  {
    id: 'r-pentomino',
    label: 'R-五连体',
    blurb: '五个细胞，炸开一千多代才安定下来。没人能提前算出这个数。',
    cells: ['.OO', 'OO.', '.O.'],
  },
  {
    id: 'acorn',
    label: '橡实',
    blurb: '七个细胞，五千多代，铺满上千格。比 R-五连体还夸张。',
    cells: ['.O.....', '...O...', 'OO..OOO'],
  },
  {
    id: 'diehard',
    label: '顽固份子',
    blurb: '看着能撑很久，第 130 代整个消失得干干净净。',
    cells: ['......O.', 'OO......', '.O...OOO'],
  },
  {
    id: 'infinite-growth',
    label: '无限增长',
    blurb: '装在 5×5 里的一小块，人口会一直涨下去。盯着规则看是看不出来的。',
    cells: ['OOO.O', 'O....', '...OO', '.OO.O', 'O.O.O'],
  },
];

export function patternSize(pattern: Pattern) {
  return {
    cols: Math.max(...pattern.cells.map(line => line.length)),
    rows: pattern.cells.length,
  };
}

export function findPattern(id: string) {
  return patterns.find(item => item.id === id);
}
