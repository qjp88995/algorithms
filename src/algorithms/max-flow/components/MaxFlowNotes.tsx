import {
  NoteCode,
  NoteItem,
  NoteLegend,
  NoteList,
  NoteSection,
  NoteTable,
} from '@/components/notes';

import { flowColors } from '../constants';

/** 页面右侧滑出的原理说明 */
export function MaxFlowNotes() {
  return (
    <>
      <NoteSection title="画布配色">
        <NoteLegend
          items={[
            { color: flowColors.source, label: '源点' },
            { color: flowColors.sink, label: '汇点' },
            { color: flowColors.edge, label: '还空着的管子' },
            { color: flowColors.flowing, label: '推了流，还没满' },
            { color: flowColors.saturated, label: '饱和：一滴也推不进去了' },
            { color: flowColors.active, label: '正在考察的边' },
            { color: flowColors.path, label: '正在往下探的增广路' },
            { color: flowColors.reverse, label: '反向边：这一段在退货' },
            { color: flowColors.cut, label: '最小割' },
            { color: flowColors.sideSource, label: '割的源点一侧' },
            { color: flowColors.sideSink, label: '割的汇点一侧' },
          ]}
        />
        <p>
          每条边是一根<span className="text-ink">管子</span>：粗细正比于容量，
          里面按「已推 / 容量」的比例灌上颜色。哪根卡住了不用读数字，
          扫一眼就知道 —— 而最小割恰好就是那些满管子里的一组。
        </p>
      </NoteSection>

      <NoteSection title="三个算法是同一个框架">
        <p>
          找一条<span className="text-ink">还能推流的路</span>
          （增广路），把它推满，重复，直到找不出来为止。三个算法的区别
          只在「下一条路怎么找」，而这个选择决定了要重复多少次。
        </p>
        <p>
          终止时的那句保证是共同的：找不到增广路 ⇔ 当前流已经是最大流。 这就是
          <span className="text-ink">最大流最小割定理</span>的一半。
        </p>
      </NoteSection>

      <NoteSection title="反向边：允许后悔">
        <p>
          全程只有一个数据结构 —— <span className="text-ink">残量网络</span>。
          每条容量为 c 的边配一条容量为 0 的反向边，推 f 单位流之后：
        </p>
        <NoteTable
          head={['方向', '残量']}
          rows={[
            ['正向', <NoteCode key="f">c − f</NoteCode>],
            ['反向', <NoteCode key="b">f</NoteCode>],
          ]}
        />
        <p>
          于是沿反向边走一步，等于
          <span className="text-ink">把之前推的流退回去一部分</span>。
          没有它，贪心一旦选错路就再也改不回来，最大流也就无从保证。
        </p>
        <p>
          切到钻石图看深度优先：它第一次会一头扎进中间那条容量 1 的窄路， 推
          1；等到该走另一边时，只能靠反向边把这 1 退掉 —— 画面上那一段
          会变成紫色，箭头朝着与管子相反的方向。这是这一页最值得盯住的一帧。
        </p>
      </NoteSection>

      <NoteSection title="选路的方式决定代价">
        <NoteList>
          <NoteItem term="Ford-Fulkerson">
            深度优先，撞见能走的边就走。整数容量下每轮至少推 1，所以一定会停，
            但次数可能和<span className="text-ink">流量本身</span>一样多 —— 上界{' '}
            <NoteCode>O(E·f)</NoteCode> 里那个 f 是流量，不是图的大小。
            容量若是无理数，它甚至可能永远停不下来。
          </NoteItem>
          <NoteItem term="Edmonds-Karp">
            只把深度优先换成广度优先，每次取
            <span className="text-ink">边数最少</span>
            的增广路。可以证明增广路长度一次比一次长，于是总次数被
            <NoteCode>O(V·E)</NoteCode> 卡死，与流量再无关系。
          </NoteItem>
          <NoteItem term="Dinic">
            先 BFS 把点按「离源点几条边」分层，再只走层次正好加一的边，
            一口气把这一层次图里所有最短增广路榨干（阻塞流）。每个相位过后
            最短增广路至少长一条边，所以最多 V 个相位。
          </NoteItem>
        </NoteList>
        <p>
          钻石图上这个差别是可数的：广度优先两条最短路走完收工； Dinic
          一个相位就把这两条一起榨干；深度优先要多绕几趟， 还得退一次货。
        </p>
      </NoteSection>

      <NoteSection title="最大流 = 最小割">
        <p>
          把点分成两堆，源点在一堆、汇点在另一堆，横跨这道口子、
          方向朝外的边的容量之和，就是这个<span className="text-ink">割</span>
          的容量。 任何一个割都是流的上界 —— 所有流量总得穿过这道口子。
        </p>
        <p>
          而算完之后，割根本不用去找：从源点出发，在
          <span className="text-ink">残量网络</span>
          里还够得着的那些点就是割的一侧。
          够不着说明中间那些边全饱和了，于是这个割的容量恰好等于当前流量 ——
          上下界撞在一起，两边同时取到最优。
        </p>
        <p>
          画面上那几条红边就是这组「卡住了整张网络」的边。想让流更大，
          只能加宽它们中的某一条；加宽别的地方一点用都没有。
        </p>
      </NoteSection>

      <NoteSection title="选哪个">
        <NoteTable
          head={['算法', '复杂度', '要点']}
          rows={[
            ['Ford-Fulkerson', 'O(E · f)', '和流量有关；容量大就慢'],
            ['Edmonds-Karp', 'O(V · E²)', '只改一行，就与流量无关了'],
            ['Dinic', 'O(V² · E)', '实践中的默认选择；单位容量下更快'],
          ]}
        />
        <p>
          单位容量的图（二分图匹配就是这一类）上 Dinic 是{' '}
          <NoteCode>O(E√V)</NoteCode>，这也是它常被用来做匹配的原因。
        </p>
      </NoteSection>

      <NoteSection title="这张网络是怎么长出来的">
        <p>
          底图仍然是最短路径页那张平面图。给每条连线定向时按
          <span className="text-ink">离源点的层次</span>从近指向远，同层的按
          下标定向 —— 这样网络无环，流从左边一路推到右边，瓶颈在哪一眼能找到。
        </p>
        <p>
          容量是 1…9 的整数，方便把割上的几条边心算加起来和最大流对一遍。
          钻石图则是手工摆的，连边的顺序都刻意安排过：
          <NoteCode>a</NoteCode> 的出边表里那条窄路排在宽路前面，
          深度优先才会先去试它。「先撞见哪条」从来不是随机的， 是邻接表的顺序。
        </p>
      </NoteSection>

      <NoteSection title="实现要点">
        <p>
          <NoteCode>lib/graph/</NoteCode> 把每条连线拆成方向相反的两条边并
          互相记住对方 —— 这个结构正好就是残量网络要的形状，所以这一页
          没有引入任何新的数据结构，只是给边配了一组容量。
        </p>
        <p>
          Dinic 的阻塞流用了<span className="text-ink">当前弧优化</span>：
          每个点记住自己试到第几条边，推满或判死之后就再也不看第二眼。
          没有它，一个相位里同一条边会被反复试，复杂度直接退化。
        </p>
        <p>
          「答案对不对」由一份独立的朴素 Edmonds-Karp 判定 ——
          要能说某个答案是错的，手里必须另有一份对的。
        </p>
      </NoteSection>
    </>
  );
}
