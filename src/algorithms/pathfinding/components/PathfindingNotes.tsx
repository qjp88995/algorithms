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
              color: `linear-gradient(90deg, ${gridColors.closedFrom}, ${gridColors.closedTo})`,
              label: '已展开（越晚越紫）',
            },
            { color: gridColors.open, label: '边界' },
            { color: gridColors.path, label: '最终路径' },
            { color: gridColors.wall, label: '墙' },
            { color: gridColors.swamp, label: '沼泽' },
          ]}
        />
        <p>
          已展开的格子按展开顺序渐变，所以颜色的推进方向就是搜索波前的推进方向。
        </p>
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
