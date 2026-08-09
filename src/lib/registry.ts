import {
  Bird,
  Blocks,
  Footprints,
  type LucideIcon,
  Waypoints,
} from 'lucide-react';

/**
 * 算法注册表 —— 驱动图标导航、⌘K 命令面板和首页卡片。
 *
 * 新增一个算法时：
 *   1. 在 `src/algorithms/<id>/` 下写页面与实现；
 *   2. 在 `src/routes/` 下加一个只做接线的路由文件；
 *   3. 把它的路径加进 `AlgorithmPath` 联合类型；
 *   4. 在 `algorithms` 里补一条元信息（含一个 lucide 图标）。
 *
 * `path` 用字面量联合而不是 string，这样 `<Link to={...}>`
 * 仍然受 TanStack Router 的类型检查保护。
 */

export type AlgorithmCategory = '群体智能' | '排序' | '图论' | '搜索';

export type AlgorithmPath =
  '/boids' | '/pathfinding' | '/maze-gen' | '/maze-runner';

export interface AlgorithmMeta {
  id: string;
  path: AlgorithmPath;
  /** 中文名 */
  name: string;
  /** 英文名，用于卡片副标题 */
  enName: string;
  category: AlgorithmCategory;
  /** 收起态导航条上显示的图标 */
  icon: LucideIcon;
  /** 一句话说明 */
  summary: string;
  tags: string[];
}

export const algorithms: AlgorithmMeta[] = [
  {
    id: 'boids',
    path: '/boids',
    name: '群鸟算法',
    enName: 'Boids / Flocking',
    category: '群体智能',
    icon: Bird,
    summary:
      '每只鸟只看邻居，只遵守分离、对齐、聚合三条局部规则，整体却涌现出鸟群般的集体运动。',
    tags: ['涌现行为', '局部规则', '空间网格'],
  },
  {
    id: 'pathfinding',
    path: '/pathfinding',
    name: '寻路算法',
    enName: 'A* / Dijkstra / BFS / Greedy',
    category: '搜索',
    icon: Waypoints,
    summary:
      '四个算法其实是同一套最佳优先搜索，只是优先队列的排序键不同 —— 换一个键，扩张形状和最优性保证就全变了。',
    tags: ['启发式', '优先队列', '四路对比'],
  },
  {
    id: 'maze-gen',
    path: '/maze-gen',
    name: '迷宫生成',
    enName: 'Maze Generation',
    category: '图论',
    icon: Blocks,
    summary:
      '四种算法长出的都是同一种东西 —— 一棵生成树。区别全在怎么长：钻到底再回头、从边界均匀蔓延、并查集合并、还是瞎走消环。',
    tags: ['生成树', '并查集', '随机游走'],
  },
  {
    id: 'maze-runner',
    path: '/maze-runner',
    name: '走迷宫',
    enName: 'Maze Running',
    category: '搜索',
    icon: Footprints,
    summary:
      '第一人称：只看得见眼前一圈，也不知道出口在哪。没有启发式、没有优先队列 —— 图搜索里免费的那一跳，在这里是要走路的。',
    tags: ['局部信息', '扶墙法', '回溯代价'],
  },
];

/** 按分类分组，保持 `algorithms` 中的原始顺序 */
export function groupByCategory(): [AlgorithmCategory, AlgorithmMeta[]][] {
  const groups = new Map<AlgorithmCategory, AlgorithmMeta[]>();
  for (const item of algorithms) {
    const list = groups.get(item.category);
    if (list) list.push(item);
    else groups.set(item.category, [item]);
  }
  return [...groups.entries()];
}

export function findByPath(path: string): AlgorithmMeta | undefined {
  return algorithms.find(item => item.path === path);
}

/** ⌘K 面板的模糊匹配：中文名、英文名、分类、标签都参与 */
export function searchAlgorithms(query: string): AlgorithmMeta[] {
  const keyword = query.trim().toLowerCase();
  if (!keyword) return algorithms;
  return algorithms.filter(item =>
    [item.name, item.enName, item.category, ...item.tags]
      .join(' ')
      .toLowerCase()
      .includes(keyword)
  );
}
