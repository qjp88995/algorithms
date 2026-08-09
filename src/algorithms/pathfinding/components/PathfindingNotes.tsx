import { NoteSection } from '@/components/AlgorithmPage';

import { algorithmLabels } from '../constants';

/** 页面下方的原理说明 */
export function PathfindingNotes() {
  return (
    <div className="max-w-3xl">
      <NoteSection title="四个算法其实是同一个">
        <p>
          它们共用一套最佳优先搜索：从优先队列里取出代价最小的节点、展开它的邻居、
          把邻居放回队列。唯一的区别是
          <strong className="text-ink">排序键</strong>：
        </p>
        <ul className="mt-2 ml-4 list-disc space-y-1">
          {(
            Object.entries(algorithmLabels) as [
              keyof typeof algorithmLabels,
              (typeof algorithmLabels)[keyof typeof algorithmLabels],
            ][]
          ).map(([id, item]) => (
            <li key={id}>
              <strong className="text-ink">{item.label}</strong>
              <span className="font-mono text-xs text-faint">
                {' '}
                key = {item.key}
              </span>
              —— {item.blurb}
            </li>
          ))}
        </ul>
        <p className="mt-2">
          其中 g 是从起点走到该节点的实际代价，h 是该节点到终点的估计距离。 BFS
          之所以能用同一个优先队列，是因为把「入队序号」当排序键时，堆的行为
          就等价于一个先进先出队列。
        </p>
      </NoteSection>

      <NoteSection title="打开四路对比看什么">
        <p>
          同一张地图上，Dijkstra 像水波一样向四周均匀铺开，A* 则被启发式牵引成
          朝终点的锥形 —— 两者路径一样长，但 A* 展开的节点少得多，这就是启发式的
          全部价值。贪心冲得最快却容易被凹形障碍骗进死胡同；BFS 无视地形权重，
          在有沼泽的地图上会给出「格数最少但实际最贵」的路径。
        </p>
      </NoteSection>

      <NoteSection title="几个容易踩的点">
        <ul className="ml-4 list-disc space-y-1">
          <li>
            <strong className="text-ink">启发式要匹配移动方式</strong>
            ：四向移动配曼哈顿，八向移动配八方距离。八向时若仍用曼哈顿就会高估，
            A* 不再保证最短路 —— 这个可以在面板上直接调出来看。
          </li>
          <li>
            <strong className="text-ink">加权 A*</strong>
            ：把权重调到 1
            以上，搜索会更贪心、展开更少，代价是路径可能不再最优。
          </li>
          <li>
            <strong className="text-ink">贪心不做代价松弛</strong>
            ：谁先发现某个节点就认谁作父节点，之后不再修正。这是它路径变差的根源；
            顺带一提，如果死胡同不在最终路径上，贪心浪费的只是展开数，路径未必更长。
          </li>
          <li>
            <strong className="text-ink">对角不切墙角</strong>
            ：只有两侧的直角邻居都不是墙时才允许斜穿，否则路径会从两堵墙的缝里穿过去。
          </li>
        </ul>
      </NoteSection>

      <NoteSection title="实现要点">
        <p>
          优先队列是手写的二叉堆，相同键时按入堆序号先进先出 —— 正是这个
          tie-break 让 BFS 能复用同一个堆。更新节点代价时不做
          decrease-key，而是直接重复入堆、弹出时跳过已展开的过期条目（惰性删除），
          代码简单且在网格规模下更快。
        </p>
      </NoteSection>
    </div>
  );
}
