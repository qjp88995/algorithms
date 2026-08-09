import {
  NoteCode,
  NoteItem,
  NoteLegend,
  NoteList,
  NoteSection,
  NoteTable,
} from '@/components/notes';

import { roadColors, ROADWORK_PENALTY } from '../constants';

/** 页面右侧滑出的原理说明 */
export function FastestPathNotes() {
  return (
    <>
      <NoteSection title="画布配色">
        <NoteLegend
          items={[
            { color: roadColors.source, label: '起点' },
            { color: roadColors.target, label: '终点' },
            {
              color: `linear-gradient(90deg, ${roadColors.free}, ${roadColors.jammed})`,
              label: '路况：畅通 → 拥堵',
            },
            { color: roadColors.closed, label: '施工封闭（虚线）' },
            { color: roadColors.routeFast, label: '时间依赖最优路线' },
            { color: roadColors.routeStatic, label: '静态（自由流）路线' },
            { color: roadColors.routeBest, label: '更早到达的路线（虚线）' },
            { color: roadColors.nodeSettled, label: '已定稿的路口' },
            { color: roadColors.nodeReached, label: '到达时刻已更新' },
            { color: roadColors.nodeActive, label: '正在展开的路口' },
            { color: roadColors.active, label: '正在检查的路段' },
            { color: roadColors.improved, label: '这一下提前了到达时刻' },
            { color: roadColors.carFast, label: '走最优路线的车' },
            { color: roadColors.carStatic, label: '走静态路线的车' },
            { color: roadColors.profileLine, label: '到达曲线' },
            { color: roadColors.profileViolation, label: '曲线上的 FIFO 违例' },
            { color: roadColors.profileMarker, label: '当前出发时刻' },
          ]}
        />
        <p>
          路上写的数字是<span className="text-ink">此刻</span>通过这段要几分钟；
          路口下面是最早到达时刻。左上角那个钟在发车动画里会走。
        </p>
      </NoteSection>

      <NoteSection title="把边权变成一个函数">
        <p>
          静态最短路里，一条边多贵是个常数。真实路网不是：同一段路早高峰要 25
          分钟，深夜只要 9 分钟。于是边权变成了
          <span className="text-ink">出发时刻的函数</span>
          <NoteCode>τ(e, t)</NoteCode>，松弛也跟着变形：
        </p>
        <p>
          <NoteCode>
            arrival[v] = min(arrival[v], t + τ(e, t))，t = arrival[u]
          </NoteCode>
        </p>
        <p>
          注意这里必须<span className="text-ink">先知道几点到 u</span>
          ，才知道这条边多长 —— 代价不再是图的静态属性，而依赖于搜索走到这里
          时的状态。除此之外，算法和普通 Dijkstra 一字不差。
        </p>
      </NoteSection>

      <NoteSection title="最短 ≠ 最快">
        <p>
          蓝线是「按空路时间选最短的那条」—— 没有实时路况的导航给的答案；
          金线是把拥堵算进去之后真正最早到的那条。拖动出发时刻，
          两条线会在一天之内反复分合：
        </p>
        <NoteList>
          <NoteItem term="深夜">
            没有拥堵，两条线重合 —— 此时最快就是最短。
          </NoteItem>
          <NoteItem term="早晚高峰">
            市区路堵到两倍以上，绕远走快速路反而更早到，两条线分开。
          </NoteItem>
        </NoteList>
        <p>
          路网里每条路有各自的「拥堵敏感度」：快速路几乎不受高峰影响，
          市区路会堵到两倍以上。如果所有路一起变慢同一个倍数，
          名次不会变，最优路线也就永远不换 —— 让代价随时刻变化还不够， 得
          <span className="text-ink">变得不一样快</span>才行。
        </p>
      </NoteSection>

      <NoteSection title="Dijkstra 凭什么还能用">
        <p>
          静态图上 Dijkstra 的底气是「边权非负，以后只会更贵」。
          时间依赖图上对应的条件叫 <span className="text-ink">FIFO</span>
          （先进先出，也叫非超车）：
        </p>
        <p>
          <NoteCode>t₁ ≤ t₂ ⟹ t₁ + τ(e, t₁) ≤ t₂ + τ(e, t₂)</NoteCode>
        </p>
        <p>
          「早出发绝不会晚到。」有了它，最早到达某个路口的那条路线就一定是
          最有希望的，把它定稿才站得住脚。
        </p>
        <p>
          平滑的潮汐拥堵天然满足 FIFO ——
          堵车只会让你慢下来，不会让后面出发的人超过你。所以把高峰强度拉到
          最大，Dijkstra 依然是对的。
        </p>
      </NoteSection>

      <NoteSection title="施工封路：FIFO 被打破">
        <p>
          打开「施工封路」，主干道上某段在 9:00 前通过要多付 {ROADWORK_PENALTY}{' '}
          分钟。于是：
        </p>
        <NoteTable
          head={['到路口的时刻', '通过之后']}
          rows={[
            ['08:55', `09:00 + ${ROADWORK_PENALTY} 分之后才出来`],
            ['09:05', '直接过，反而更早到对面'],
          ]}
        />
        <p>
          <span className="text-ink">晚到路口的那辆车先到终点</span>
          —— FIFO 不成立了。这时 Dijkstra 仍然只给每个路口留一个标签（最早到达
          的那个），于是那条「慢一点到路口、但能赶上放行」的路线根本不会被考虑。
          它不会报错，只是给一个不是最优的答案；统计栏里的「FIFO 失效」
          就是拿一个多标签搜索把更优路线找出来做的对照。
        </p>
        <p>
          到达曲线上这件事看得最清楚：红色的那几段里，出发晚一分钟，
          <span className="text-ink">到达时刻反而提前</span>。
          平滑的拥堵永远画不出这种段落。
        </p>
      </NoteSection>

      <NoteSection title="等待，把 FIFO 补回来">
        <p>打开「允许在节点等待」，代价函数换成了「等一会儿再走」的最优值：</p>
        <p>
          <NoteCode>τ*(e, t) = min(w ≥ 0) [ w + τ(e, t + w) ]</NoteCode>
        </p>
        <p>
          这个函数一定满足 FIFO —— 早到的车总可以选择站在原地等，
          把自己变成晚到的那辆，所以早到永远不吃亏。于是 Dijkstra 重新变对，
          代价只是路线里多了一段「在路口等放行」。
        </p>
        <p>
          反过来说：
          <span className="text-ink">
            不允许等待的非 FIFO 最早到达 问题，一般是 NP 困难的
          </span>
          。这一页的对照用的是多标签搜索
          （每个路口留若干个不同的到达时刻），它不声称找到全局最优 ——
          但只要它拿得出一条更早到的路线，就足以证明 Dijkstra 的答案不是最优。
        </p>
      </NoteSection>

      <NoteSection title="一天的到达曲线">
        <p>
          单跑一次搜索只知道这一趟花了多久。把一天扫一遍（每 10
          分钟发一趟车，各做一次完整搜索），才会看见结构：
        </p>
        <NoteList>
          <NoteItem term="两个鼓包">
            早晚高峰，同一段路要多花一半时间。
          </NoteItem>
          <NoteItem term="鼓包不对称">
            晚高峰更宽更钝 —— 下班时间比上班时间散得多。
          </NoteItem>
          <NoteItem term="断崖">
            施工放行那一刻，行程时长直接掉下去；掉得比一分钟还快的那几段 就是
            FIFO 违例。
          </NoteItem>
        </NoteList>
        <p>真实导航里的「建议 X 点出发」，算的就是这条曲线的极小值。</p>
      </NoteSection>

      <NoteSection title="和最短路径那一页的区别">
        <p>
          那一页的边权是个数，可正可负，但
          <span className="text-ink">始终是个数</span>；难点在负权破坏了
          「定稿」的正当性。这一页的边权是个
          <span className="text-ink">函数</span>
          ，全都非负，难点在于它随时刻变化 —— 于是「定稿」需要的不再是非负，而是
          FIFO。 两页问的其实是同一个问题：Dijkstra 那句「这个点已经定了」，
          到底靠什么撑着。
        </p>
      </NoteSection>
    </>
  );
}
