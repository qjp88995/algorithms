# CLAUDE.md

算法可视化演示站。每个算法一个路由，画布 + 实时可调参数 + 原理说明。

## 架构决策（"为什么这么选"——代码里看不出来）

**不是 monorepo。** 纯前端 SPA，没有后端、没有数据库。参考项目 `../smart-property`
的 turbo/workspace 结构在这里是纯负担，只保留了它的 docker 开发流程和 CI 约定。

**没有 Traefik。** 单个服务直接映射端口即可，不需要反向代理做路由分发。

**路由文件里的组件不导出。** TanStack Router 的 `autoCodeSplitting` 只有在组件仅被
`Route` 引用时才能把它拆成独立 chunk。实测在路由文件里 `export` 组件后，boids 的
23kB 会被并回主包（299 + 23 → 322kB 单包）。所以 `src/routes/*.tsx` 只做三行接线，
组件放 `src/algorithms/<id>/` 或 `src/pages/`。这样
`react-refresh/only-export-components` 也能全局开着、零告警。

**共享内核放 `lib/`，而且只在第二个用户出现之后。** `lib/maze/` 里的生成器
是被三个页面同时要走才搬过去的（迷宫生成页是主角，寻路和走迷宫拿它铺地形）。
在那之前它就待在 `pathfinding/maze.ts` 里 —— 一份实现只有一个用户时，
放在用它的地方比放在"公共"的地方更好找。`lib/graph/` 和 `lib/min-heap.ts`
同理：前者在最短路径和最快路径两页同时要一张"看得懂的平面图"时才成立，
后者是第三个用户（网格寻路、最短路径、最快路径）出现时才从
`pathfinding/search.ts` 里搬出来的。`lib/disjoint-set.ts` 同样：它在迷宫生成的
Kruskal 里内联待了整整一页的时间，直到最小生成树页也要用才抽出来。

**`lib/graph/` 只给几何与拓扑，不给代价。** 两个图论页对"图长什么样"的要求
完全一致，对"边多贵"的定义毫无共同点：最短路径页挂的是可正可负的整数权重，
最快路径页挂的是随时刻变化的通行时间函数。所以边权一律由各页自己按边下标存
`Float64Array`，不进共享模型。

**算法内核不碰 canvas、不碰 React。** `flock.ts` / `search.ts` 都是纯数值计算，
canvas 绘制在 `render.ts`，React 状态在 hook 里。这样内核可以直接单元测试，
现在 103 个测试全跑在内核上，一个都不需要渲染组件。

**可变的模拟状态用 ref，不进 state。** 位置/速度是 `Float32Array`，网格是原地修改的
`Uint8Array`，每帧都在变，克隆一份毫无意义。注意 React 19 的 lint 规则禁止在渲染期间
读写 ref，所以：把 **ref 对象本身**传给子组件（如 `PathfindingBoard` 的 `gridRef`），
子组件只在事件处理和 effect 里解引用。

**rAF 循环只在挂载时建立一次。** 所有会被用户随手拖动的参数通过一个 `liveRef` 传进
循环。否则每动一下滑块就重建循环，拖尾会闪、帧率统计也会断。

**快捷键走注册表，不各自挂 window 监听。** `src/lib/hotkeys.ts` 是全站唯一的 keydown
入口，组件用 `useHotkeys` 注册绑定、卸载时自动注销。这样冲突可判定（后注册的盖前面的，
即页面级优先于全局），`?` 速查表列的就是此刻真正生效的绑定 —— 表和实现不可能对不上。
只认单键：⌘K 那种带修饰键的仍归命令面板，带修饰键的事件一律放行，免得吞掉 ⌘R。

## 代码组织约定

```
src/
├── routes/              只做接线，三行一个文件；组件一律不导出
├── pages/               非算法页面（首页）
├── components/          跨算法复用：AlgorithmPage 外壳、controls、notes 原语
├── lib/registry.ts      算法注册表，驱动图标导航 / ⌘K / 首页卡片
├── lib/hotkeys.ts       全站快捷键注册中心
├── lib/maze/            迷宫网格与四种生成器（生成本身是一页，寻路/走迷宫拿它当地形）
├── lib/graph/           平面有向图：生成、几何、命中测试（最短路径 / 最快路径共用）
├── lib/min-heap.ts      二叉最小堆（三个搜索页 + Prim 共用）
├── lib/disjoint-set.ts  并查集（迷宫的 Kruskal / 最小生成树共用）
└── algorithms/<id>/     一个算法一个目录，内容全部收在里面
    ├── <Id>Page.tsx     页面：把画布和面板塞进 AlgorithmPage 的插槽
    ├── use<Id>.ts       状态中枢 + rAF 循环，产出各组件的 props
    ├── components/      画布、控制面板、原理说明
    ├── <kernel>.ts      纯逻辑内核 + 同名 .spec.ts
    ├── render.ts        canvas 绘制
    ├── constants.ts     默认配置、预设、配色、各种上限
    └── types.ts         类型
```

**新增一个算法**：建 `src/algorithms/<id>/` → 加 `src/routes/<id>.tsx`（三行）→ 在
`src/lib/registry.ts` 的 `AlgorithmPath` 联合类型和 `algorithms` 数组里各加一条
（含一个 lucide 图标）。分类不够用就扩 `AlgorithmCategory`。

把 `playback`（`running` / `onToggle` / `onStep` / `onReset`）接到 `AlgorithmPage` 上，
就自动拿到 Space / S / R —— 这三个动作在每个演示里语义都一样，别各自再绑一套。
算法特有的键用 `useHotkeys` 在页面组件里注册，`group` 填算法名，速查表按它分段。

**样式**：Tailwind v4，主题 token 定义在 `src/index.css` 的 `@theme` 里
（`bg-surface`、`text-muted`、`border-line` 等）。画布里的颜色不走 Tailwind，
统一放各算法的 `constants.ts`，因为要传给 canvas 2D context。

**原理说明**：用 `src/components/notes.tsx` 的原语（NoteSection / NoteList /
NoteTable / NoteCode / NoteLegend），面板宽约 400px，排版按窄栏设计。
**画布上出现的每种颜色都要在 NoteLegend 里有对应条目** —— 没有图例的配色等于没有信息。

## 命令执行

所有命令都在容器里跑，**不要在宿主机上执行 pnpm**：

```bash
docker compose up -d                        # 开发服务器 → http://localhost:8896
docker compose logs -f web                  # 看日志
docker compose run --rm cli pnpm test       # 测试
docker compose run --rm cli pnpm lint       # lint
docker compose run --rm cli pnpm typecheck  # 类型检查
docker compose run --rm cli pnpm build      # 生产构建（内含 typecheck）
docker compose run --rm cli pnpm add xxx    # 加依赖
```

宿主机和容器里项目的绝对路径不同（`/home/...` vs `/workspace`），pnpm 会把 storeDir
的绝对路径写进 `node_modules/.modules.yaml`；两边交替安装会触发"清空 node_modules"
确认，容器里没有 TTY 就直接失败。

**例外是 git**：git 和 husky 钩子留在宿主机，镜像里不装 git。容器里 `pnpm install` 会
提示 git 找不到，这是预期的，不影响安装。

**端口 8896** 是按宿主机现状挑的（88xx 段其余多被别的项目占用）。改端口设
`WEB_PORT`，compose 映射和 Vite 的 HMR clientPort 会一起跟着变。

**验证服务时**从 Claude Code 的 shell 里 curl 宿主机映射端口一律超时，这是 shell 沙箱
限制，不代表服务有问题。要验证用
`docker compose exec -T web wget -qO- http://localhost:5173/<路径>`。

**用 gh 时一律套 `timeout`**，并优先用 `gh api`（REST）：`gh repo view` / `gh repo
create` 这类走 GraphQL 的子命令在这个环境里会挂住（实测 20 秒无响应被 kill，而同一
时刻 curl api.github.com 1.1 秒返回 200）。

## 提交规范

- commit message 用英文，不要加 `Co-Authored-By`
- 每完成一个独立任务就提交一次
- pre-commit 钩子（宿主机）会跑 lint-staged + typecheck
- push 到 main 会触发 CI（lint/test/build）和镜像构建
  （`ghcr.io/qjp88995/algorithms-web`）

## 别做的事

- 别在路由文件里导出组件（会毁掉按路由分包）
- 别在渲染期间读写 ref，别在 effect 里同步 setState（React 19 lint 会直接报错）
- 别为了让规则通过就关规则；先想想是不是结构该调
- 别把模拟内核和 canvas / React 混在一起
- 别新建 .md 文档，除非明确要求
