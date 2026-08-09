import {
  NoteCode,
  NoteItem,
  NoteLegend,
  NoteList,
  NoteSection,
  NoteTable,
} from '@/components/notes';

import { graphColors } from '../constants';

/** 页面右侧滑出的原理说明 */
export function ShortestPathNotes() {
  return (
    <>
      <NoteSection title="画布配色">
        <NoteLegend
          items={[
            { color: graphColors.source, label: '起点' },
            { color: graphColors.target, label: '终点' },
            { color: graphColors.nodeReached, label: '距离已更新（暂定）' },
            { color: graphColors.nodeSettled, label: '已定稿（Dijkstra）' },
            { color: graphColors.nodeActive, label: '正在展开的节点' },
            { color: graphColors.nodePivot, label: '中转点 k（Floyd）' },
            { color: graphColors.edge, label: '正权边（两向同价）' },
            { color: graphColors.edgeNegative, label: '负权边（单向）' },
            { color: graphColors.active, label: '正在检查的边' },
            { color: graphColors.improved, label: '这一下改小了距离' },
            { color: graphColors.tree, label: '最短路树（父指针）' },
            { color: graphColors.path, label: '起点到终点的最短路' },
            { color: graphColors.detour, label: '正在试的绕行 i⇝k⇝j' },
            { color: graphColors.cycle, label: '负环' },
            { color: graphColors.wrong, label: '距离与精确解不符' },
          ]}
        />
        <p>
          节点里是名字，圆下面那行是<span className="text-ink">当前距离</span>
          ，还没被碰到就是 <NoteCode>∞</NoteCode>。两向同价的边画成一条不带箭头
          的线 —— 方向此时不携带信息；一旦某个方向被翻成负权，它就分成两条各
          带箭头的线，画面上的不对称正对应代价上的不对称。
        </p>
      </NoteSection>

      <NoteSection title="三个算法只有一个动作">
        <p>
          它们做的都是<span className="text-ink">松弛一条边</span>：
        </p>
        <p>
          <NoteCode>
            if dist[u] + w(u,v) &lt; dist[v]: dist[v] = dist[u] + w(u,v)
          </NoteCode>
        </p>
        <p>
          「绕道 u 再走这条边，比现在记的更近，那就改小它。」 区别只在
          <span className="text-ink">按什么顺序检查边</span>，
          以及由这个顺序换来的保证。看单步时盯住白线就够了 ——
          它每次落在哪条边上，就是这三个算法唯一的分歧。
        </p>
      </NoteSection>

      <NoteSection title="Dijkstra：赌「以后只会更贵」">
        <p>
          每次挑出当前距离最小的节点，宣布它
          <span className="text-ink">定稿</span>
          ，此后不再修改。凭什么能这么武断？因为剩下的路每一步都得加上一个非负
          的边权，只会越走越贵 —— 这个理由在出现负权边的一刻就没了。
        </p>
        <p>把负权比例拉起来，画面上会出现标红的节点。最小的一个反例是：</p>
        <NoteTable
          head={['边', '权重']}
          rows={[
            ['A → B', '2'],
            ['A → C', '5'],
            ['C → B', '−4'],
          ]}
        />
        <p>
          真正的最短是 <NoteCode>A→C→B = 1</NoteCode>，但 Dijkstra 会在 B 还是 2
          的时候就把它定稿，那条 <NoteCode>−4</NoteCode> 再也进不来。
          它不会报错、不会死循环，只是安静地给一个错答案 —— 这比崩溃危险得多。
        </p>
      </NoteSection>

      <NoteSection title="Bellman-Ford：不挑，轮着来">
        <p>
          不维护优先队列，把<span className="text-ink">所有边</span>从头到尾松弛
          一轮，再来一轮，共 V−1 轮。为什么是 V−1？因为没有负环时最短路一定是
          简单路径，最多 V−1 条边；而第 k 轮结束时，所有「最多用 k 条边走到」的
          距离都已经是对的。
        </p>
        <NoteList>
          <NoteItem term="提前收工">
            某一轮一条边都没松弛动，说明距离表已是不动点，后面几轮跑了也是白跑。
            画面上的「轮次」经常远小于 V−1，就是这个优化在起作用。
          </NoteItem>
          <NoteItem term="负环检测">
            V−1 轮之后再跑一轮，如果还能松弛成功，那就只有一种解释：
            存在一个绕一圈总代价为负的环，沿着它转可以让距离无限变小。
          </NoteItem>
        </NoteList>
      </NoteSection>

      <NoteSection title="Floyd-Warshall：换一个维度递推">
        <p>
          前两个都在问「从起点到 v 多远」，Floyd 问的是另一个问题：
          <span className="text-ink">
            只允许中转前 k 个点时，i 到 j 最短是多少。
          </span>
        </p>
        <p>
          <NoteCode>
            d[k][i][j] = min(d[k−1][i][j], d[k−1][i][k] + d[k−1][k][j])
          </NoteCode>
        </p>
        <p>
          k 从 0 推到 V，一张表就填满了 —— 而且是
          <span className="text-ink">全源</span>
          的，任意两点都有答案。画布上只显示起点那一行，紫色的 k 是当前中转点，
          虚线是正在试的那条绕行。
        </p>
        <p>
          代价是 <NoteCode>O(V³)</NoteCode> 雷打不动：图再稀疏，三重循环也一次
          不少。统计栏里 Floyd 的「检查边」永远精确等于 V³，另外两个则跟着图的
          稀疏程度走 —— 这就是它们的分野。
        </p>
      </NoteSection>

      <NoteSection title="负权、负环，不是一回事">
        <NoteList>
          <NoteItem term="只有负权">
            最短路照样存在，只是不能再用「定稿」这套贪心。Bellman-Ford 和 Floyd
            都给得出正确答案。
          </NoteItem>
          <NoteItem term="出现负环">
            沿环转一圈总代价为负，多转一圈就更便宜，最短距离是负无穷 ——
            问题本身没有解。此时能做的只有把环
            <span className="text-ink">报出来</span>。
          </NoteItem>
        </NoteList>
        <p>
          所以这一页把负权做成滑块、负环做成开关：随机撒负权边时会主动检查并
          回退，保证不会意外长出环。想看负环，得自己按那个开关。
        </p>
      </NoteSection>

      <NoteSection title="选哪个">
        <NoteTable
          head={['算法', '复杂度', '负权', '用在什么时候']}
          rows={[
            [
              'Dijkstra',
              'O(E log V)',
              '不行',
              '单源、边权非负 —— 绝大多数情况',
            ],
            ['Bellman-Ford', 'O(V·E)', '可以', '有负权，或者需要检测负环'],
            ['Floyd-Warshall', 'O(V³)', '可以', '点少、要的是全部点对'],
          ]}
        />
        <p>
          三者在本页都跑完整棵树、不在终点提前退出，「检查边」的数字才具有
          可比性。实际用 Dijkstra 时当然可以一碰到终点就停。
        </p>
      </NoteSection>

      <NoteSection title="和寻路那一页的区别">
        <p>
          网格寻路里边是隐含的：邻居靠坐标算出来，代价挂在格子上，而且永远非负。
          这一页把<span className="text-ink">边本身</span>变成一等公民 ——
          可以有方向、正反不同价、可以为负 —— 于是那些在网格上根本无法出现的
          问题（定稿失效、负环、全源表）才有地方谈。
        </p>
      </NoteSection>

      <NoteSection title="实现要点">
        <p>
          图是先撒点再连边长出来的：泊松盘采样保证节点不挤在一起，欧氏最小生成树
          保证连通，之后按长度从短到长补边、凡是与已有边交叉的一律跳过。
          得到的近似平面图没有打结的线，「这条明显绕远」才能用眼睛判断。
          权重正比于线长并取整到 1…9，也是为了能心算复核算法给的答案。
        </p>
        <p>
          Dijkstra 复用了网格寻路那个二叉堆：不做 decrease-key，距离变小就重复
          入堆，弹出时靠 <NoteCode>settled</NoteCode> 跳过过期条目。
          「答案对不对」则由一份独立的朴素 Bellman-Ford 判定 ——
          要能说某个答案是错的，手里必须另有一份对的。
        </p>
      </NoteSection>
    </>
  );
}
