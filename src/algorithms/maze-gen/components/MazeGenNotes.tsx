import {
  NoteCode,
  NoteItem,
  NoteLegend,
  NoteList,
  NoteSection,
  NoteTable,
} from '@/components/notes';

import { algorithmLabels, componentSwatch, mazeColors } from '../constants';

export function MazeGenNotes() {
  return (
    <>
      <NoteSection title="画布配色">
        <NoteLegend
          items={[
            { color: mazeColors.wall, label: '还没打通的墙' },
            { color: mazeColors.cell, label: '已并入迷宫的通道' },
            {
              color: mazeColors.active,
              label: '活跃集合：栈上 / 边界里 / 正被游走',
            },
            { color: mazeColors.cursor, label: '正在操作的那一格' },
            {
              color: componentSwatch,
              label: 'Kruskal：连通块（同色即已连通）',
            },
          ]}
        />
      </NoteSection>

      <NoteSection title="四种算法的产物完全同构">
        <p>
          它们生成的都是<span className="text-ink">完美迷宫</span>：任意两格之间
          有且只有一条路。用图论的话说，这是一棵覆盖所有通道格的
          <span className="text-ink">生成树</span> —— 连通、无环，
          边数恰好是格数减一。
        </p>
        <p>
          所以别指望从结果上分辨它们。四种算法真正的区别是
          <span className="text-ink">怎么长出来的</span>，
          而这只能看过程。打开四路对比，四块画布用同一个种子同时开长。
        </p>
      </NoteSection>

      <NoteSection title="四种长法">
        <NoteList>
          {(
            Object.entries(algorithmLabels) as [
              keyof typeof algorithmLabels,
              (typeof algorithmLabels)[keyof typeof algorithmLabels],
            ][]
          ).map(([id, item]) => (
            <NoteItem key={id} term={item.label}>
              {item.blurb}
            </NoteItem>
          ))}
        </NoteList>
        <p>
          最容易看出来的是<span className="text-ink">递归回溯</span>和
          <span className="text-ink">Prim</span>：前者永远只有一个活跃头在钻，
          活跃集合是一条长长的栈；后者的活跃集合是整整一圈，
          所以四面同时往外长。
        </p>
      </NoteSection>

      <NoteSection title="死胡同数就是手感">
        <p>
          「手感」听起来很虚，其实可以量化：数一下只有一个出口的格子。
          递归回溯总是走到底才回头，于是挖出细长走廊、岔口少； Prim
          每次从整圈边界随机挑，岔口密，死胡同能多出一半。
        </p>
        <NoteTable
          head={['算法', '活跃集合', '手感']}
          rows={[
            ['递归回溯', <NoteCode key="a">栈</NoteCode>, '长走廊、拐弯多'],
            [
              '随机 Prim',
              <NoteCode key="b">边界集合</NoteCode>,
              '短分叉、死胡同多',
            ],
            [
              '随机 Kruskal',
              <NoteCode key="c">并查集</NoteCode>,
              '接近 Prim，略更碎',
            ],
            [
              'Wilson',
              <NoteCode key="d">游走路径</NoteCode>,
              '无偏好，最"平均"',
            ],
          ]}
        />
        <p>
          面板底部的「死胡同」在跑完那一下才统计 —— 四路对比时把这一栏
          横着读一遍，差距一目了然。
        </p>
      </NoteSection>

      <NoteSection title="Wilson 慢在哪，又换来了什么">
        <p>
          看「步数」和「并入」这两栏的比值：前三种约等于 1，Wilson 能到
          几十。它绝大部分时间在走后来被自己抹掉的环 ——
          随机游走一旦绕回自己走过的格子，那一整圈就被丢弃。
        </p>
        <p>
          换来的是<span className="text-ink">均匀性</span>：Wilson
          在所有可能的生成树里等概率抽样。另外三种都有偏好 ——
          递归回溯偏爱长走廊，Prim 偏爱短分叉 ——
          它们生成的迷宫是「某一类」迷宫，而不是「随便一个」迷宫。
        </p>
      </NoteSection>

      <NoteSection title="和另外两页的关系">
        <NoteList>
          <NoteItem term="寻路算法">
            那一页的「迷宫」按钮用的就是这里的递归回溯，一次跑完当地形。
            因为完美迷宫路径唯一，四个寻路算法在上面会给出同一条路 ——
            那时比的是展开了多少格，不是路好不好。
          </NoteItem>
          <NoteItem term="走迷宫">
            那一页是第一人称：只看得见眼前，不知道出口在哪。
            这里的死胡同数直接决定了那边有多难走。
          </NoteItem>
        </NoteList>
      </NoteSection>

      <NoteSection title="实现要点">
        <p>
          四种算法共用一个可单步的接口（<NoteCode>step</NoteCode> /
          <NoteCode>advance</NoteCode> / <NoteCode>runToEnd</NoteCode>），
          和寻路的搜索内核同构。布局上奇数坐标是通道格、偶数坐标是墙，
          生成时在通道格之间跳两格前进、打通中间那格 —— 墙因此有厚度。
        </p>
      </NoteSection>
    </>
  );
}
