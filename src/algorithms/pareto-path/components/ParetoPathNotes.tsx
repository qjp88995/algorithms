import {
  NoteCode,
  NoteItem,
  NoteLegend,
  NoteList,
  NoteSection,
  NoteTable,
} from '@/components/notes';

import { paretoColors } from '../constants';

/** 页面右侧滑出的原理说明 */
export function ParetoPathNotes() {
  return (
    <>
      <NoteSection title="画布配色">
        <NoteLegend
          items={[
            { color: paretoColors.source, label: '起点' },
            { color: paretoColors.target, label: '终点' },
            {
              color: `linear-gradient(90deg, ${paretoColors.roadFree}, ${paretoColors.roadToll})`,
              label: '道路：慢而免费 → 快而收费',
            },
            { color: paretoColors.supported, label: '前沿解（加权和选得到）' },
            {
              color: paretoColors.unsupported,
              label: '凹处解（虚线，选不到）',
            },
            { color: paretoColors.selected, label: '当前选中的那条' },
            { color: paretoColors.nodeLabels, label: '路口留着的标签越多越亮' },
            { color: paretoColors.nodeActive, label: '正在展开的标签所在路口' },
            { color: paretoColors.active, label: '正在检查的路段' },
            { color: paretoColors.accepted, label: '这一下产生了新标签' },
            { color: paretoColors.dominated, label: '代价空间里被支配的路线' },
            { color: paretoColors.isoLine, label: '当前偏好的等权重线' },
          ]}
        />
        <p>
          路上写的是<NoteCode>时间′ ¥收费</NoteCode>；路口下面的
          <NoteCode>×n</NoteCode> 是它此刻留着几个标签 —— 单目标 Dijkstra
          在这里永远只会写 1。
        </p>
      </NoteSection>

      <NoteSection title="两个不能换算的代价">
        <p>
          这张路网上每条路有两个价钱：走多久，和过路费多少。收费快速路又快又贵，
          国道慢但免费。于是「最短路」这个说法失效了 ——
        </p>
        <p>
          <NoteCode>116 分 ¥43</NoteCode> 和 <NoteCode>212 分 ¥5</NoteCode>
          ，哪个更短？
        </p>
        <p>
          没有答案。除非你先说出一分钟值几块钱，否则这两条路
          <span className="text-ink">谁也不比谁差</span>。真实导航给你三个选项
          而不是一条路，原因就在这里。
        </p>
      </NoteSection>

      <NoteSection title="支配：唯一的武器">
        <p>
          没法比较不代表什么都比不了。如果一条路
          <span className="text-ink">两项都不比另一条差</span>
          ，那后者可以当场扔掉 —— 这叫支配：
        </p>
        <p>
          <NoteCode>(t₁, c₁) ≼ (t₂, c₂) ⟺ t₁ ≤ t₂ 且 c₁ ≤ c₂</NoteCode>
        </p>
        <p>
          剩下互不支配的那些解就是<span className="text-ink">帕累托前沿</span>
          。因为互不支配，它们排起来必然是「越快越贵」的一条阶梯 ——
          时间递增的同时收费递减。答案不是一条路，是这一组。
        </p>
        <p>
          支配也是算法唯一的剪枝手段。没有它，标签数会随路径条数指数爆炸；
          有了它，绝大多数半成品在生成的那一刻就被扔掉了 ——
          统计栏里「剪掉」那个数通常是「前沿」的几十倍。
        </p>
      </NoteSection>

      <NoteSection title="从一个数变成一组标签">
        <p>
          算法（Martins 的标签设定法）和 Dijkstra 是同一个骨架，只换了一处：
          节点上存的东西。
        </p>
        <NoteTable
          head={['', 'Dijkstra', '这一页']}
          rows={[
            ['节点上存', '一个距离', '一组互不支配的标签'],
            ['松弛', '更小就覆盖', '塞不进这组就丢掉'],
            ['出堆即定稿', '边权非负', '按时间出堆，后来的时间只会更大'],
            ['答案', '一条路', '一组路'],
          ]}
        />
        <p>
          堆按时间排序，所以标签是按时间递增出堆的。一个标签一旦出堆，
          将来生成的标签时间只会更大，不可能再支配它 ——
          这就是「定稿」在双目标下的说法。
        </p>
        <p>
          还有一刀剪在终点上：新标签如果已经被
          <span className="text-ink">终点</span>
          现有的某个解支配，直接扔 —— 代价非负，它继续走下去只会更差。
        </p>
      </NoteSection>

      <NoteSection title="为什么不能「加权求和」了事">
        <p>常见的偷懒办法是给两个目标配个权重，压成一个数再跑普通 Dijkstra：</p>
        <p>
          <NoteCode>cost = λ·时间 + (1-λ)·过路费</NoteCode>
        </p>
        <p>
          它确实能跑，而且每个 λ 给的解都在前沿上。问题在于反过来不成立：
          <span className="text-ink">
            前沿上有些解，无论 λ 取什么都拿不到。
          </span>
        </p>
        <p>
          在代价空间里看得最清楚。等式 <NoteCode>λ·t + (1-λ)·c = 常数</NoteCode>{' '}
          是一条直线，λ 只决定它的斜率。求最小值就是把这条线从左下方平推上去，
          第一个碰到的点就是答案 —— 于是它永远只会停在
          <span className="text-ink">下凸包的角点</span>上。
          凹进去的那些解，被这条直线整个跨了过去。
        </p>
        <NoteList>
          <NoteItem term="角点（实心）" color={paretoColors.supported}>
            存在一段 λ 让它成为加权和最优。
          </NoteItem>
          <NoteItem term="凹处（空心）" color={paretoColors.unsupported}>
            在前沿上，货真价实的最优解，但任何权重都选不中它。
          </NoteItem>
        </NoteList>
        <p>
          拖动 λ 滑块，看那条金色虚线怎么转 —— 它扫过整整 90
          度，选中的解却只在角点之间跳。
        </p>
      </NoteSection>

      <NoteSection title="代价空间怎么读">
        <p>
          下面那张图里，一个点就是一条路：横轴时间，纵轴过路费。左下角是理想
          （又快又便宜），越往右上越差。
        </p>
        <NoteList>
          <NoteItem term="灰点" color={paretoColors.dominated}>
            搜索途中到过终点、后来被支配掉的路线。
          </NoteItem>
          <NoteItem term="亮点">
            活下来的前沿 —— 正好是那团灰点的左下边界。
          </NoteItem>
          <NoteItem term="细线" color={paretoColors.supported}>
            角点连成的下凸包；加权和的能力范围就到这条线为止。
          </NoteItem>
        </NoteList>
        <p>点任意一个亮点，画布上就会高亮它对应的那条路。</p>
      </NoteSection>

      <NoteSection title="代价：标签会爆炸">
        <p>
          每个路口留几个标签，就意味着搜索规模乘以几。路口下面的
          <NoteCode>×n</NoteCode> 是实时读数，把节点数或度数拉高，
          它涨得比节点数快得多。
        </p>
        <p>
          最坏情况下前沿本身就可以有<span className="text-ink">指数条</span>解
          —— 双目标最短路是 NP 困难的，不是因为算法笨，而是因为
          答案本身可能就有那么多。实用系统里的做法通常是放弃精确： 只要 ε
          近似的前沿，或者只留 K 个有代表性的解。
        </p>
        <p>这一页设了标签上限；撞上了会在统计栏里说，并中止搜索。</p>
      </NoteSection>

      <NoteSection title="和另外两页的关系">
        <p>
          最短路径那一页问的是「边权可以为负时，定稿还成不成立」；
          最快路径那一页问的是「边权随时刻变化时，定稿靠什么撑着」。
          这一页换了个问法：
          <span className="text-ink">
            边权根本不是一个数的时候，还有没有最优解
          </span>
          ？
        </p>
        <p>
          有，只是它不再是一条路。而一旦答案是一组，「先定权重再优化」
          这种做法就会悄悄丢掉一部分答案 —— 丢掉哪些，取决于前沿的形状，
          而那是你在定权重之前根本不知道的事。
        </p>
      </NoteSection>
    </>
  );
}
