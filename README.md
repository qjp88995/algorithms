# 算法演示 · Algorithm Playground

可交互的算法可视化演示站。每个算法一个独立路由，画布铺满、参数实时可调，
点开右侧的原理说明边读边看。

<https://github.com/qjp88995/algorithms>

## 已实现

### 群鸟算法 · Boids / Flocking

每只鸟只看邻居，只遵守分离、对齐、聚合三条局部规则，整体却涌现出鸟群般的集体运动。

- 点击任意一只鸟，看它的视野扇形、到邻居的连线，以及三个转向力的箭头
- **感知方式**可以在度量（视野半径内全部）和拓扑（最近 k 个，不管多远）之间切换。
  真实椋鸟用的是后者（k ≈ 6–7），所以被冲散后还能迅速重聚 —— 切到拓扑、把群拉稀疏，
  能直接看出度量模式会解体而拓扑模式不会
- **物种预设**：椋鸟群（拓扑感知、后方盲区、失速约束）与沙丁鱼群（侧线无盲区、
  近场排斥强、可近乎悬停）。算法一字不改，差别全在参数
- **捕食者**：代码里只多做两件事（近距离放大排斥 + 按恐慌放大聚合），
  闪散、喷泉效应、饵球三种现象自己涌现出来
- 均匀网格 + 计数排序做邻居查找，两千只仍跑满 60fps

### 寻路算法 · A\* / Dijkstra / BFS / Greedy

四个算法其实是同一套最佳优先搜索，只是优先队列的排序键不同。

| 算法         | 排序键    | 保证最短路             |
| ------------ | --------- | ---------------------- |
| A\*          | `g + w·h` | w = 1 且启发式可采纳时 |
| Dijkstra     | `g`       | 总是                   |
| BFS          | 入队序    | 仅等权图               |
| 贪心最佳优先 | `h`       | 否                     |

- **四路对比**：四块画布共享同一张地图同时跑，各自统计展开数和路径代价
- 拖动绘制墙和沼泽（进入代价 6），拖动两端的圆点移动起点终点
- 暂停时改地形是实时重算的，点播放才逐帧看扩张
- 一键生成迷宫或随机障碍
- 已展开的格子按展开顺序渐变着色，颜色推进的方向就是搜索波前的方向

## 技术栈

React 19 · TypeScript · Vite · TanStack Router（文件路由 + 自动分包）·
Tailwind CSS v4 · Canvas 2D · Vitest · pnpm · Docker

## 本地开发

所有命令都在容器里跑，宿主机不需要装 Node 或 pnpm。

```bash
docker compose up -d
```

打开 <http://localhost:8896>。改端口设 `WEB_PORT`（compose 映射和 Vite 的 HMR
会一起跟着变）。

```bash
docker compose logs -f web                  # 看日志
docker compose run --rm cli pnpm test       # 测试
docker compose run --rm cli pnpm lint       # lint
docker compose run --rm cli pnpm typecheck  # 类型检查
docker compose run --rm cli pnpm build      # 生产构建
docker compose run --rm cli pnpm add xxx    # 加依赖
docker compose down                         # 停掉
```

> 依赖只在容器里安装。宿主机和容器里项目的绝对路径不同，pnpm 记录的 store 路径会对不上，
> 交替安装会要求清空 `node_modules`。git 和 husky 钩子则相反，留在宿主机上跑。

宿主机 UID/GID 不是 1000 时，首次构建加上参数：

```bash
docker compose build --build-arg UID=$(id -u) --build-arg GID=$(id -g)
```

## 目录结构

```
src/
├── routes/              只做接线，三行一个文件
├── pages/               非算法页面（首页）
├── components/          AlgorithmPage 外壳、控件、说明面板原语
├── lib/registry.ts      算法注册表，驱动导航 / ⌘K 搜索 / 首页卡片
└── algorithms/<id>/     一个算法一个目录
    ├── <Id>Page.tsx     页面
    ├── use<Id>.ts       状态 + 渲染循环
    ├── components/      画布 / 控制面板 / 原理说明
    ├── <kernel>.ts      纯逻辑内核 + 单元测试
    ├── render.ts        canvas 绘制
    ├── constants.ts     默认值、预设、配色
    └── types.ts         类型
```

算法内核（`flock.ts`、`search.ts`）不碰 canvas 也不碰 React，是纯数值计算，
所以能直接做单元测试 —— 目前 40 个测试全部跑在内核上。

## 新增一个算法

1. 建 `src/algorithms/<id>/`，内核、渲染、组件、常量各就各位
2. 加 `src/routes/<id>.tsx`，只做接线：

   ```tsx
   import { createFileRoute } from '@tanstack/react-router';
   import { XxxPage } from '@/algorithms/xxx/XxxPage';

   export const Route = createFileRoute('/xxx')({ component: XxxPage });
   ```

   注意组件不要在路由文件里导出，否则 TanStack 的自动分包会失效。

3. 在 `src/lib/registry.ts` 的 `AlgorithmPath` 和 `algorithms` 里各加一条

## 部署

push 到 `main` 会触发两个 workflow：CI（lint / test / build）和镜像构建。
镜像推到 GHCR：

```bash
docker run -p 8080:80 ghcr.io/qjp88995/algorithms-web:latest
```

nginx 已配好 HTML5 history fallback，直接访问 `/boids` 这类路由不会 404。
