import {
  NoteCode,
  NoteItem,
  NoteLegend,
  NoteList,
  NoteSection,
  NoteTable,
} from '@/components/notes';

import { algorithmLabels, gridColors } from '../constants';

/** 页面右侧滑出的原理说明 */
export function PathfindingNotes() {
  return (
    <>
      <NoteSection title="画布配色">
        <NoteLegend
          items={[
            {
              color: `linear-gradient(90deg, ${gridColors.openNext}, ${gridColors.openLate})`,
              label: '边界（越亮越先被展开）',
            },
            { color: gridColors.cursor, label: '正在展开的那一格' },
            { color: gridColors.pulse, label: '刚展开的一瞬' },
            {
              color: `linear-gradient(90deg, ${gridColors.closedFrom}, ${gridColors.closedTo})`,
              label: '已展开（越晚越紫）',
            },
            { color: gridColors.path, label: '最终路径' },
            { color: gridColors.walker, label: '沿路径走的光点' },
            { color: gridColors.start, label: '起点' },
            { color: gridColors.goal, label: '终点' },
            { color: gridColors.wall, label: '墙' },
            { color: gridColors.swamp, label: '沼泽' },
          ]}
        />
        <p>
          已展开的格子按展开顺序渐变，所以颜色的推进方向就是搜索波前的推进方向。
        </p>
      </NoteSection>

      <NoteSection title="边界的亮度就是优先队列">
        <p>
          边界那一圈不是同一个颜色：每一格的亮度对应它在优先队列里的
          <span className="text-ink">排序键</span>，最亮的那格下一个就被弹出。
          点「单步」能一格一格看清这件事 ——
          白框跳到最亮的边界格上，它变成已展开，邻居入队，整圈亮度随即重排。
        </p>
        <p>于是四个算法的差别在同一张图上直接可读，不用等它们跑完再比形状：</p>
        <NoteList>
          <NoteItem term="Dijkstra">
            整圈亮度几乎均匀，像等高线 —— 它对方向没有任何偏好。
          </NoteItem>
          <NoteItem term="贪心">
            朝终点那一侧亮出一条脊，后方的边界几乎全黑，永远不会被回头考虑。
          </NoteItem>
          <NoteItem term="A*">
            亮的一侧同样指向终点，但被 <NoteCode>g</NoteCode>{' '}
            拽住，梯度比贪心平缓 —— 这就是它既定向又不放弃最优性的样子。
          </NoteItem>
          <NoteItem term="BFS">
            键是入队序号，亮度呈一层一层的条带，同层之间没有优劣。
          </NoteItem>
        </NoteList>
      </NoteSection>

      <NoteSection title="四个算法其实是同一个">
        <p>
          它们共用一套最佳优先搜索：从优先队列取出代价最小的节点、展开邻居、
          再放回队列。唯一的区别是<span className="text-ink">排序键</span>。
        </p>
        <NoteTable
          head={['算法', '排序键', '保证最短路']}
          rows={[
            [
              'A*',
              <NoteCode key="a">g + w·h</NoteCode>,
              'w = 1 且启发式可采纳时',
            ],
            ['Dijkstra', <NoteCode key="d">g</NoteCode>, '总是'],
            ['BFS', <NoteCode key="b">入队序</NoteCode>, '仅等权图'],
            ['贪心', <NoteCode key="g">h</NoteCode>, '否'],
          ]}
        />
        <p>
          <NoteCode>g</NoteCode> 是起点到该节点的实际代价，
          <NoteCode>h</NoteCode> 是该节点到终点的估计距离。BFS
          能复用同一个优先队列，
          是因为把入队序号当排序键时，堆的行为就等价于先进先出队列。
        </p>
      </NoteSection>

      <NoteSection title="打开四路对比看什么">
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
          最直观的一组是 Dijkstra 和 A*：路径一样长，但 A*
          被启发式牵引成朝终点的锥形，
          展开的节点少得多。这就是启发式的全部价值。
        </p>
      </NoteSection>

      <NoteSection title="几个容易踩的点">
        <NoteList>
          <NoteItem term="启发式要匹配移动方式">
            四向配曼哈顿，八向配八方距离。八向时仍用曼哈顿会高估，A*
            就不再保证最短路 —— 这个可以在面板上直接调出来看。
          </NoteItem>
          <NoteItem term="加权 A*">
            权重调到 1 以上会更贪心、展开更少，代价是路径可能不再最优。
          </NoteItem>
          <NoteItem term="贪心不做代价松弛">
            谁先发现某个节点就认谁作父节点，之后不再修正，这是它路径变差的根源。
            顺带一提：如果死胡同不在最终路径上，贪心浪费的只是展开数，路径未必更长。
          </NoteItem>
          <NoteItem term="BFS 无视权重">
            在有沼泽的地图上，它给出的是「格数最少但实际最贵」的路径。
          </NoteItem>
          <NoteItem term="对角不切墙角">
            只有两侧的直角邻居都不是墙时才允许斜穿，否则路径会从两堵墙的缝里穿过去。
          </NoteItem>
        </NoteList>
      </NoteSection>

      <NoteSection title="实现要点">
        <p>
          优先队列是手写的二叉堆，键相同时按入堆序号先进先出 —— 正是这个
          tie-break 让 BFS 能复用同一个堆。更新节点代价时不做 decrease-key，
          而是直接重复入堆、弹出时跳过已展开的过期条目（惰性删除），
          代码更简单，在网格规模下也更快。
        </p>
      </NoteSection>
    </>
  );
}
