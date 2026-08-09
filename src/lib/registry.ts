import {
  ArrowUpNarrowWide,
  Bird,
  Blocks,
  CornerUpRight,
  Footprints,
  Gauge,
  type LucideIcon,
  Network,
  Scale,
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
  | '/boids'
  | '/sorting'
  | '/pathfinding'
  | '/maze-gen'
  | '/maze-runner'
  | '/shortest-path'
  | '/fastest-path'
  | '/pareto-path'
  | '/turn-cost';

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
    id: 'sorting',
    path: '/sorting',
    name: '排序算法',
    enName: 'Sorting Algorithms',
    category: '排序',
    icon: ArrowUpNarrowWide,
    summary:
      '六种排序的结果一模一样，差别全在代价 —— 比较了多少次、搬了多少次。换一种输入分布，谁快谁慢还会当场对调。',
    tags: ['比较与写入', '最坏情形', '分布敏感'],
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
    id: 'shortest-path',
    path: '/shortest-path',
    name: '最短路径',
    enName: 'Dijkstra / Bellman-Ford / Floyd-Warshall',
    category: '图论',
    icon: Network,
    summary:
      '离开网格，回到一般加权图：边可以有方向、正反不同价、甚至为负。Dijkstra 那句「这个点定稿了」到底凭什么成立，负权一出现就见分晓。',
    tags: ['松弛', '负权与负环', '全源最短路'],
  },
  {
    id: 'fastest-path',
    path: '/fastest-path',
    name: '最快路径',
    enName: 'Time-Dependent Shortest Path',
    category: '图论',
    icon: Gauge,
    summary:
      '同一条路，早高峰和深夜不是一个价。代价随出发时刻变化之后，最短的那条路往往不是最快的那条，Dijkstra 也得先满足 FIFO 才还算数。',
    tags: ['时间依赖', 'FIFO 假设', '出发时刻'],
  },
  {
    id: 'pareto-path',
    path: '/pareto-path',
    name: '帕累托权衡',
    enName: 'Multi-Objective Shortest Path',
    category: '图论',
    icon: Scale,
    summary:
      '时间和过路费没有换算率，「最短」这个词当场失效。答案变成一组互不支配的路 —— 而给两个目标配权重求和这种偷懒做法，会漏掉其中一部分。',
    tags: ['帕累托前沿', '支配剪枝', '标签设定'],
  },
  {
    id: 'turn-cost',
    path: '/turn-cost',
    name: '转弯代价',
    enName: 'Turn Costs / State Expansion',
    category: '搜索',
    icon: CornerUpRight,
    summary:
      '转弯要花时间，于是同一条边两个价钱 —— 取决于你是从哪边进来的。dist[格子] 装不下这件事，只好把朝向也塞进状态：节点数当场翻四倍。',
    tags: ['状态扩展', '代价依赖路径', '四倍搜索空间'],
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
