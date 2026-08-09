import {
  NoteCode,
  NoteItem,
  NoteLegend,
  NoteList,
  NoteSection,
  NoteTable,
} from '@/components/notes';

import { componentColors, graphColors } from '../constants';

/** 页面右侧滑出的原理说明 */
export function SpanningTreeNotes() {
  return (
    <>
      <NoteSection title="画布配色">
        <NoteLegend
          items={[
            { color: graphColors.root, label: '根' },
            { color: componentColors[0], label: '同一个分量（颜色一致）' },
            { color: graphColors.node, label: '还没被碰过的孤点' },
            { color: graphColors.nodeActive, label: '这一拍那条边的两端' },
            { color: graphColors.edge, label: '还没考察的边' },
            { color: graphColors.active, label: '正在考察的边' },
            { color: graphColors.tree, label: '已收进生成树' },
            { color: graphColors.candidate, label: '本轮候选出边（Borůvka）' },
            { color: graphColors.rejected, label: '考察过、成环被丢掉' },
            { color: graphColors.shortestTree, label: '对照：最短路树' },
            { color: graphColors.detour, label: '这一拍被丢掉 / 绕得最远的点' },
          ]}
        />
        <p>
          边上的数字是权重，正比于线长并取整到 1…9 —— 你可以先用眼睛挑出
          「看着最短的那些边」，再看算法收下的是不是同一批，最后把它们加起来
          和统计栏的总权重对一遍。
        </p>
      </NoteSection>

      <NoteSection title="三个算法只有一个动作">
        <p>
          它们做的都是<span className="text-ink">考察一条边，决定收不收</span>：
          两端还不连通就收下（合并两块），已经连通就丢掉（收了会成环）。
          区别只在<span className="text-ink">按什么顺序考察</span>，
          以及由这个顺序换来的效率。
        </p>
        <p>
          跑完之后三棵树完全相同 —— 不是碰巧，是同一个最优解。
          但三者的「考察边」次数差得很远，这才是选谁的理由。
        </p>
      </NoteSection>

      <NoteSection title="凭什么贪心是对的">
        <NoteList>
          <NoteItem term="割性质">
            把所有点任意分成两半，横跨这道口子的边里
            <span className="text-ink">最便宜的那条一定在某棵最小生成树上</span>
            。 道理很直接：假如某棵最优树没用它，把它加进去必然成环，环上
            必有另一条横跨同一道口子的边，换掉那条只会更便宜（或持平）。
          </NoteItem>
          <NoteItem term="环性质">
            任取一个环，环上<span className="text-ink">最重的那条边</span>
            一定可以不要 —— 去掉它，两端仍然靠环上其余的边连着。
          </NoteItem>
        </NoteList>
        <p>
          三个算法每一次「收下」都是割性质的一次应用，每一次「丢掉」都是环
          性质的一次应用。Kruskal 丢边时那条边一定是环上最重的 ——
          它是按权重从小到大轮到的，环上其余的边全都更早被收过。
        </p>
      </NoteSection>

      <NoteSection title="Kruskal：全局排序，碎片合并">
        <p>
          一上来每个点各自成块。把所有边按权重排队，从最便宜的开始一条条问
          并查集：<NoteCode>find(u) === find(v)</NoteCode> 吗？是就丢，
          不是就收下并 <NoteCode>union</NoteCode>。
        </p>
        <p>
          画面上是一堆彩色斑块各自长大再并成一片 —— 这是三种里唯一能直接 看见
          <span className="text-ink">并查集在合并</span>的。收满 V−1 条
          边就可以停，剩下的边不必再看。
        </p>
      </NoteSection>

      <NoteSection title="Prim：一棵树滚雪球">
        <p>
          从根开始，手里永远只有<span className="text-ink">一棵</span>树。
          每次接上「这棵树伸出去最便宜的那条边」，用一个最小堆管候选。
        </p>
        <p>
          它不需要判环 —— 只要另一端还不在树里，接上就不可能成环。
          堆里那些指向已入树节点的条目是过期的，弹出时直接跳过
          （惰性删除，和最短路径页的 Dijkstra 是同一套）。
        </p>
        <p>
          换根不改变结果，只改变<span className="text-ink">过程</span>：
          点画布上任意一个点试试，雪球从哪儿开始滚，最后那棵树都一样。
        </p>
      </NoteSection>

      <NoteSection title="Borůvka：所有分量一起动">
        <p>
          最古老的那个 —— 1926 年为摩拉维亚的电网设计，比另外两个都早。
          每一轮：每个分量各自找一条最便宜的出边，然后
          <span className="text-ink">一次性全部接上</span>。
        </p>
        <p>
          为什么只要 log V 轮？因为每个分量都至少接出去一条边，合并之后
          每个新分量至少吞掉两个旧分量 —— 分量数每轮至少减半。
          代价是每轮都得重扫一遍所有边，所以它的「考察边」次数最多。
        </p>
        <p>
          它天然并行：各分量互不干涉，可以真的同时算。现代的并行与分布式
          最小生成树算法基本都是从这里出发的。
        </p>
      </NoteSection>

      <NoteSection title="并列的权重会咬人">
        <p>
          权重<span className="text-ink">互不相同</span>时最小生成树是唯一的。
          一旦有并列，「一棵最小生成树」就可能有好几棵，总权重分毫不差，
          边集却不一样 —— 三个算法各挑各的，看着像谁算错了。
        </p>
        <p>
          Borůvka 还更严重：两个分量可能<span className="text-ink">互选</span>
          不同的边，一轮接上去直接成环。所以它的正确性前提就写着「边权互异」。
        </p>
        <p>
          这一页统一用 <NoteCode>(权重, 边下标)</NoteCode> 当比较键，把并列
          打破成全序 —— 三个算法才会给出同一棵树。这是个人为的规定，但任何
          实现都得选一个，区别只在它是否被写下来。
        </p>
      </NoteSection>

      <NoteSection title="它不是最短路树">
        <p>这是这一页最值得按的开关。两棵树优化的根本不是一回事：</p>
        <NoteList>
          <NoteItem term="最小生成树">
            <span className="text-ink">整棵树的总长度</span>最省。
            至于根到某个点要绕多远，它一点也不管。
          </NoteItem>
          <NoteItem term="最短路树">
            <span className="text-ink">根到每一个点</span>都最近。
            至于总共用掉多少边长，它一点也不管。
          </NoteItem>
        </NoteList>
        <p>三个点就能看出来：</p>
        <NoteTable
          head={['边', '权重']}
          rows={[
            ['A — B', '3'],
            ['A — C', '3'],
            ['B — C', '2'],
          ]}
        />
        <p>
          最小生成树取 <NoteCode>B—C</NoteCode> 和 <NoteCode>A—B</NoteCode>，
          总长 5；从 A 出发的最短路树取两条 3，总长 6。反过来，沿生成树从 A 走到
          C 要 <NoteCode>3+2=5</NoteCode>，而真正的最短是 3。
        </p>
        <p>
          打开对照，每个点下面会写「沿生成树走 / 真正的最短」，
          红色的就是被坑了的点。总权重那一栏永远是生成树更小，
          绕远倍数那一栏永远是生成树更差 —— 各自赢在自己定义的那件事上。
        </p>
      </NoteSection>

      <NoteSection title="选哪个">
        <NoteTable
          head={['算法', '复杂度', '用在什么时候']}
          rows={[
            ['Kruskal', 'O(E log E)', '稀疏图；边本来就排好序时几乎白送'],
            ['Prim', 'O(E log V)', '稠密图；配斐波那契堆是 O(E + V log V)'],
            ['Borůvka', 'O(E log V)', '要并行、要分布式'],
          ]}
        />
        <p>
          三者的复杂度都被排序或堆操作主导，实际差距往往取决于图有多密。
          把平均度数拉到 5 再对比一下「考察边」这个数字。
        </p>
      </NoteSection>

      <NoteSection title="和迷宫生成那一页">
        <p>
          迷宫生成里的「随机 Kruskal」就是这里的 Kruskal，只是边权换成了随机数
          —— 一棵随机权重下的最小生成树。那一页的四种算法长出的都是生成树，
          区别在于它们各自偏爱什么形状的树；这一页则是给定权重后只认
          <span className="text-ink">最省的那一棵</span>。
        </p>
      </NoteSection>

      <NoteSection title="实现要点">
        <p>
          图是先撒点再连边长出来的：泊松盘采样保证节点不挤在一起，
          之后按长度从短到长补边、凡是与已有边交叉的一律跳过。得到的
          近似平面图没有打结的线，「这条明显更短」才能用眼睛判断。
        </p>
        <p>
          Kruskal 和 Borůvka 共用一个并查集（路径压缩 + 按秩合并），Prim 复用
          最短路径页那个二叉堆。「答案对不对」由一份独立的朴素 Kruskal 判定 ——
          要能说某个答案是错的，手里必须另有一份对的。
        </p>
        <p>
          对照那棵最短路树是这张图加这个根的确定性质，跟播放进度无关，
          所以它在算法之外一次算好。切换对照因此不会打断正在播的动画。
        </p>
      </NoteSection>
    </>
  );
}
