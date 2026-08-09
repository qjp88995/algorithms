import {
  NoteCode,
  NoteItem,
  NoteLegend,
  NoteList,
  NoteSection,
  NoteTable,
} from '@/components/notes';

import { turnColors } from '../constants';

/** 页面右侧滑出的原理说明 */
export function TurnCostNotes() {
  return (
    <>
      <NoteSection title="画布配色">
        <NoteLegend
          items={[
            { color: turnColors.start, label: '起点（箭头是初始朝向）' },
            { color: turnColors.goal, label: '终点' },
            { color: turnColors.wall, label: '障碍' },
            { color: turnColors.floor, label: '空地' },
            {
              color: `linear-gradient(90deg, ${turnColors.waveFrom}, ${turnColors.waveTo})`,
              label: '已定稿的状态：早 → 晚',
            },
            { color: turnColors.open, label: '算过代价、还没定稿的状态' },
            { color: turnColors.active, label: '正在展开的状态' },
            { color: turnColors.routeBest, label: '状态空间最优路线' },
            { color: turnColors.routeStepsFirst, label: '步数优先的路线' },
            { color: turnColors.routeNaive, label: '朴素记账的路线（虚线）' },
          ]}
        />
        <p>
          路线上的圆点标的是<span className="text-ink">转弯处</span>；
          这一页比的就是「多走两步」和「少转一个弯」哪个划算，数得清弯，
          账才看得懂。
        </p>
      </NoteSection>

      <NoteSection title="代价不再只属于边">
        <p>
          网格寻路里走一格就是走一格，代价是这条边自己的属性。真车不是这样：
          减速、打方向、再加速 —— 转弯是要花时间的，掉头更贵。
        </p>
        <p>
          把这件事写进代价函数，麻烦立刻来了：从北边进来再往东走要转 90°，
          从西边进来往东走却是直行。
          <span className="text-ink">同一条边，两个价钱</span>
          ，取决于你是怎么来的。
        </p>
        <p>
          于是 <NoteCode>dist[格子]</NoteCode> 这个数组装不下需要的东西了 ——
          它记住了「到这里多少钱」，却漏掉了「到这里时车头朝哪」，
          而后面那半才决定接下来贵不贵。
        </p>
      </NoteSection>

      <NoteSection title="把朝向塞进状态">
        <p>标准解法简单得有点无趣：让节点带上朝向。</p>
        <p>
          <NoteCode>状态 = 格子 × 4，state = cell × 4 + dir</NoteCode>
        </p>
        <p>
          在这张放大四倍的图上，边权重新变回「只跟边有关」的常数 —— 从{' '}
          <NoteCode>(c, d)</NoteCode> 到 <NoteCode>(c′, d′)</NoteCode> 的代价 是{' '}
          <NoteCode>1 + 转弯罚金(d, d′)</NoteCode>，和你更早之前怎么走完全无关。
          Dijkstra 于是一个字都不用改。
        </p>
        <p>
          画布上每个格子切成四个三角，就是这四个状态。看它们
          <span className="text-ink">分别在不同时刻亮起来</span>：
          有的格子四个朝向全被定稿过，有的只亮一两个 ——
          那是从别的方向进来根本不划算。
        </p>
        <p>
          代价写在统计栏里：「已定稿状态」的分母是可通行格子数的四倍 ——
          让转弯计价，买单的是搜索空间。
        </p>
      </NoteSection>

      <NoteSection title="对照一：先把路走短">
        <p>
          很自然的想法是分两步走：先求步数最少的路线，在这些路线里再挑转弯最少的。
          它同样在状态空间上搜索，转弯数算得一点没错 ——
          <span className="text-ink">错的是目标</span>。
        </p>
        <p>
          步数被当成了硬约束，于是「多绕两步、少转两个弯」这种交易根本进不了
          候选集，哪怕一次转弯顶五步。默认这张图上它少走 2 步、多转 2 个弯，
          总账反而贵 8。
        </p>
        <p>
          把转弯代价拖到 0，这个差距会消失；拖得越高，差距越大。
          <span className="text-ink">
            两个目标之间该怎么换算，是问题给的，不是算法能自己定的。
          </span>
        </p>
      </NoteSection>

      <NoteSection title="对照二：在格子层面记账">
        <p>
          另一个更常见的写法是根本不扩状态，就着老代码改：还是
          <NoteCode>dist[格子]</NoteCode>，转弯罚金按「父指针推出来的进入方向」
          现算。
        </p>
        <p>它跑得通，给出的也是一条真能走的路线 —— 错在别处：</p>
        <NoteTable
          head={['时刻', '发生了什么']}
          rows={[
            ['定稿格子 c', '顺带把「以什么朝向到达 c」也定死了'],
            ['之后', '一条代价稍大、但朝向更顺的路来了'],
            ['结果', 'c 已关闭，那条路连被考虑的机会都没有'],
          ]}
        />
        <p>
          它<span className="text-ink">经常恰好给出最优解</span>
          —— 这才是最麻烦的地方。默认这张图上它的转弯数和最优一样多， 只是白绕了
          4 步；换几张图，它往往又对了。这种「大部分时候对」的实现，
          比每次都错的难查得多。
        </p>
      </NoteSection>

      <NoteSection title="状态扩展是个通用套路">
        <p>
          「当前状态不足以决定未来代价」时，就把缺的那部分塞进状态里 ——
          这一招在很多地方是同一件事：
        </p>
        <NoteList>
          <NoteItem term="转弯代价">格子 → 格子 × 朝向（这一页）</NoteItem>
          <NoteItem term="油量 / 电量">节点 → 节点 × 剩余里程</NoteItem>
          <NoteItem term="换乘惩罚">车站 → 车站 × 当前线路</NoteItem>
          <NoteItem term="时间依赖">
            节点 → 节点 ×
            时刻（最快路径那一页用的是另一种办法：让边权变成时刻的函数）
          </NoteItem>
        </NoteList>
        <p>
          代价永远是同一个：状态数乘上去了。四个朝向还好，
          真到了「油量」那种连续量，就得离散化，或者干脆换一套算法。
        </p>
      </NoteSection>

      <NoteSection title="和寻路那一页的区别">
        <p>
          寻路页问的是「同一个搜索骨架，换一个排序键会怎样」；这一页的骨架和
          排序键都没变，动的是<span className="text-ink">节点本身是什么</span>。
          把「显示状态空间」关掉，画面就退回那一页的样子 ——
          同一张图，看见的东西少了四分之三。
        </p>
      </NoteSection>
    </>
  );
}
