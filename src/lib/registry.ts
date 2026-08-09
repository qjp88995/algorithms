/**
 * 算法注册表 —— 驱动首页卡片和侧边导航。
 *
 * 新增一个算法时：
 *   1. 在 `src/routes/` 下加一个路由文件，如 `astar.tsx`；
 *   2. 把它的路径加进 `AlgorithmPath` 联合类型；
 *   3. 在 `algorithms` 里补一条元信息。
 *
 * `path` 用字面量联合而不是 string，这样 `<Link to={...}>`
 * 仍然受 TanStack Router 的类型检查保护。
 */

export type AlgorithmCategory = '群体智能' | '排序' | '图论' | '搜索';

export type AlgorithmPath = '/boids';

export interface AlgorithmMeta {
  id: string;
  path: AlgorithmPath;
  /** 中文名 */
  name: string;
  /** 英文名，用于卡片副标题 */
  enName: string;
  category: AlgorithmCategory;
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
    summary:
      '每只鸟只看邻居，只遵守分离、对齐、聚合三条局部规则，整体却涌现出鸟群般的集体运动。',
    tags: ['涌现行为', '局部规则', '空间网格'],
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
