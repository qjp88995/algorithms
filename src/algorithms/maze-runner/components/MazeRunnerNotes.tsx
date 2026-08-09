import {
  NoteCode,
  NoteItem,
  NoteLegend,
  NoteList,
  NoteSection,
  NoteTable,
} from '@/components/notes';

import { algorithmLabels, runnerColors, trailSwatch } from '../constants';

export function MazeRunnerNotes() {
  return (
    <>
      <NoteSection title="画布配色">
        <NoteLegend
          items={[
            { color: runnerColors.fog, label: '还没见过的地方' },
            { color: runnerColors.wall, label: '见过的墙' },
            { color: runnerColors.cell, label: '见过但没踏足的通道' },
            { color: trailSwatch, label: '踏过的路（越红说明白走越多次）' },
            { color: runnerColors.runner, label: '走的人（三角指着朝向）' },
            { color: runnerColors.start, label: '起点' },
            { color: runnerColors.goal, label: '出口（见到才画出来）' },
          ]}
        />
      </NoteSection>

      <NoteSection title="和寻路页是互补的两面">
        <p>
          寻路那一页是<span className="text-ink">上帝视角</span>
          ：整张地图随时可查，所以能算启发式、能从边界里挑全局最小的一格展开。
          这一页只有一个实体，它只看得见眼前一圈，也不知道出口在哪。
        </p>
        <p>
          差的不只是信息量。最佳优先搜索展开完这一格，下一格可能在地图另一头 ——
          图搜索里「跳过去」不要钱，实体必须
          <span className="text-ink">走过去</span>。所以这里的代价是
          <span className="text-ink">走过的步数</span>，含每一段回头路，
          而不是展开了多少格。
        </p>
        <p>
          把「迷雾」关掉，画面立刻变回上帝视角 —— 那一下就是两页之间的全部区别。
        </p>
      </NoteSection>

      <NoteSection title="四种走法要多少记忆">
        <NoteTable
          head={['走法', '需要记住', '保证']}
          rows={[
            ['扶墙法', <NoteCode key="a">只有朝向</NoteCode>, '仅单连通迷宫'],
            ['Trémaux', <NoteCode key="b">地上的标记</NoteCode>, '任意迷宫'],
            ['深度优先', <NoteCode key="c">整张已知图</NoteCode>, '任意迷宫'],
            [
              '随机游走',
              <NoteCode key="d">什么都不记</NoteCode>,
              '概率 1，但极慢',
            ],
          ]}
        />
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
      </NoteSection>

      <NoteSection title="扶墙法为什么会失效">
        <p>
          它的正确性依赖一个前提：
          <span className="text-ink">
            出口所在的那面墙， 必须和入口那面墙是连着的
          </span>
          。手贴着同一面墙走，走遍的也就是这一面墙。
        </p>
        <p>
          一旦迷宫有环、出口落在中间的孤岛上，那座岛的墙和外圈不相连，
          扶墙法会沿外圈绕回原地，然后永远重复。这一页的迷宫都是
          <span className="text-ink">完美迷宫</span>（无环，见「迷宫生成」页），
          所以它总能走出去 —— 但那是迷宫的性质在替它兜底，不是它自己的本事。
        </p>
      </NoteSection>

      <NoteSection title="回溯在这里是要走路的">
        <p>
          寻路页的搜索回溯只是把栈弹一格，不花任何代价。这里的深度优先每退一格
          都得<span className="text-ink">真的原路走回去</span>，一步就是一步。
          画面上那些反复蹭亮、发红的通道，就是这笔账。
        </p>
        <p>
          对比一下「步数」和「踏足」两栏：踏足数最多就是通道格总数，而步数可以
          远高于它 —— 高出的部分全是回头路。随机游走能高出几十倍。
        </p>
      </NoteSection>

      <NoteSection title="打开四路对比看什么">
        <NoteList>
          <NoteItem term="谁先出去">
            四种走法走的是同一张迷宫（同一个种子），谁的步数少一目了然。
          </NoteItem>
          <NoteItem term="轨迹的颜色">
            扶墙法沿着一侧墙铺出一条长长的单色路径；Trémaux 很少让哪一格变红；
            随机游走会把起点附近烧成一团。
          </NoteItem>
          <NoteItem term="多换几张迷宫">
            出口每次随机落在离起点最远的那一档里。位置一变，扶墙法的成绩会明显
            起伏 —— 出口贴着外墙时它几乎直达，缩在树的深处时它得把大半棵树蹭
            一遍。Trémaux 和深度优先受这个影响小得多，因为它们本来就在做系统的
            探索。
          </NoteItem>
          <NoteItem term="迷宫越大差距越大">
            把尺寸拉到最大再看随机游走 ——
            它的期望步数随格数增长得比另外三种快得多。
          </NoteItem>
        </NoteList>
      </NoteSection>
    </>
  );
}
