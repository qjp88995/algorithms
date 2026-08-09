import {
  NoteCode,
  NoteItem,
  NoteLegend,
  NoteList,
  NoteSection,
  NoteTable,
} from '@/components/notes';

import { clusterColors, paletteColors } from '../constants';

/** 页面右侧滑出的原理说明 */
export function ClusteringNotes() {
  return (
    <>
      <NoteSection title="画布配色">
        <NoteLegend
          items={[
            { color: paletteColors[0], label: '同一个簇（颜色一致）' },
            { color: clusterColors.pending, label: '还没轮到的点' },
            { color: clusterColors.noise, label: '被判为噪声' },
            { color: clusterColors.cursor, label: '这一拍在看的点' },
            { color: clusterColors.reach, label: 'eps 邻域（DBSCAN）' },
            { color: clusterColors.center, label: '中心（K-means）' },
            { color: clusterColors.trail, label: '中心移动的轨迹' },
            { color: clusterColors.merge, label: '发生过的合并（层次）' },
          ]}
        />
        <p>
          DBSCAN 里<span className="text-ink">实心</span>的是核心点，
          <span className="text-ink">空心</span>的是边界点 ——
          后者挨着核心点，但自己周围并不稠密。打开真值对照后每个点还会描一圈
          真实分组的颜色，填充和描边对不上的就是分错的。
        </p>
      </NoteSection>

      <NoteSection title="分歧不在效率，在「簇是什么」">
        <NoteList>
          <NoteItem term="K-means">
            簇是<span className="text-ink">围着一个中心的球</span>。
            于是它划出的边界永远是直的（两个中心的中垂线），
            而且必须事先说好要几个。
          </NoteItem>
          <NoteItem term="DBSCAN">
            簇是<span className="text-ink">连成一片的稠密区域</span>。
            形状随意，稀疏处判为噪声，簇数由数据自己说了算 —— 代价是 eps 和
            minPts 得调。
          </NoteItem>
          <NoteItem term="层次聚类">
            簇是<span className="text-ink">一路合并出来的</span>。
            怎么定义「两簇有多近」，就长出什么形状。
          </NoteItem>
        </NoteList>
        <p>
          谁都没有错，只是假设不同。换个数据集，赢家就换人 ——
          这一页要看的就是这件事。
        </p>
      </NoteSection>

      <NoteSection title="K-means 在月牙上必然失败">
        <p>
          这是进页面就摆在眼前的一幕。两个月牙交错咬合，它们的
          <span className="text-ink">重心几乎重合</span>
          —— 而 K-means 唯一的判据就是「离哪个重心近」。于是它只能画一条
          笔直的线把两个月牙一起拦腰切开，各切一半。
        </p>
        <p>
          底下的吻合度会掉到 0.3 上下。同心圆更极端，直接掉到 0 ——
          没有任何一条直线能把一个圆环和它包住的圆分开。
        </p>
        <p>
          注意它<span className="text-ink">不会报错</span>：迭代照样收敛，
          簇内平方和照样降到局部最小，结果照样自信满满。 这比崩溃危险得多。
        </p>
      </NoteSection>

      <NoteSection title="它还看初始中心的脸色">
        <p>
          Lloyd 迭代只保证收敛到<span className="text-ink">局部</span>最优。
          切到高斯团、关掉 K-means++、连按几次「重掷初始中心」——
          数据一个点都没动，只是起点换了，吻合度就可能从 1.00 掉到 0.4：
          两个中心落进了同一个团，剩下那个团只好被一个中心独吞。
        </p>
        <p>
          K-means++ 就是冲着这个来的：第一个中心随便挑，之后每个中心按
          <NoteCode>D(x)²</NoteCode>
          加权抽 —— 离已有中心越远的点越可能被选中。它一行迭代都没改，
          却把「运气不好就分错」压下去一大截。
        </p>
      </NoteSection>

      <NoteSection title="DBSCAN 的两个旋钮">
        <p>
          它不问要几个簇，只问两件事：多近算<NoteCode>挨着</NoteCode>
          （eps），多少个邻居算<NoteCode>稠密</NoteCode>（minPts）。
        </p>
        <NoteList>
          <NoteItem term="核心点">
            eps 邻域里的点数达到 minPts。核心点之间只要挨着就连成一片。
          </NoteItem>
          <NoteItem term="边界点">
            自己不稠密，但落在某个核心点的邻域里 —— 收进那个簇，画成空心。
          </NoteItem>
          <NoteItem term="噪声">
            两头都不沾。它是唯一一个会说「这个点哪儿也不属于」的算法。
          </NoteItem>
        </NoteList>
        <p>
          代价在于这两个旋钮很敏感。慢慢拖 eps：小了簇碎成渣，大了两个月牙
          直接并成一个，吻合度从 1.00 掉到 0。「刚刚好」的那一段比想象的窄。
        </p>
        <p>
          「疏密不均」那份数据更难办：同一个 eps 对紧的那团刚好，
          对松的那团就偏小，松团边缘一圈会被判成噪声。
          <span className="text-ink">一个全局的密度阈值</span>本来就没法同时
          伺候两种密度 —— 这正是 OPTICS、HDBSCAN 想解决的问题。
        </p>
      </NoteSection>

      <NoteSection title="连接方式决定形状">
        <p>层次聚类每步都合并「最近」的两个簇，而最近有好几种算法：</p>
        <NoteTable
          head={['方式', '两簇距离', '脾气']}
          rows={[
            ['单连接', '最近的一对点', '能顺着细线串下去，追得出非凸形状'],
            ['全连接', '最远的一对点', '偏爱紧凑的球，和 K-means 像'],
            ['平均连接', '所有点对的平均', '介于两者之间'],
          ]}
        />
        <p>
          在同心圆上换着试：单连接顺着环一路串完，吻合度 1.00； 另外两种掉到 0.1
          上下。同一个算法框架，只换了一行距离定义。
        </p>
        <p>
          单连接的代价是<span className="text-ink">链式效应</span>：
          两个本该分开的团，只要中间有一串挨得近的点，就会被串成一个。
          它对噪声很敏感 —— 好处和坏处是同一件事。
        </p>
      </NoteSection>

      <NoteSection title="没有结构的时候">
        <p>
          切到「均匀噪声」。这份数据里压根没有簇，但三个算法照样给出一个
          划分，而且看着挺整齐。吻合度是 0，因为真值里根本没有分组可比。
        </p>
        <p>
          这是聚类最该记住的一条：
          <span className="text-ink">算法不会告诉你「其实没有结构」</span>。
          它只会执行你给的假设。「这几个簇是真的吗」是使用者的问题，
          不是算法的。
        </p>
      </NoteSection>

      <NoteSection title="吻合度是怎么算的">
        <p>
          用的是<span className="text-ink">调整兰德指数</span>。直接比标签
          没有意义 —— 簇号只是编号，把 0 和 1 对调之后还是同一个划分。
          所以比的是成对关系：任取两个点，两种划分是否都认为它们同组。
        </p>
        <p>
          「调整」是把随机瞎分的期望得分减掉，于是 1 是完全一致、0 相当于
          瞎猜、负数比瞎猜还差。噪声点各算各的一组，所以把大片数据判成噪声
          也是要付出分数代价的。
        </p>
        <p>
          真值只用来算这个数，三个算法全程只能看到坐标 —— 没有它，「K-means
          在月牙上失败了」只是一句观感。
        </p>
      </NoteSection>

      <NoteSection title="实现要点">
        <p>
          K-means 的分配阶段拆成<span className="text-ink">一点一步</span>：
          整轮一次算完在画面上是一闪而过，而这一页要看的恰恰是边界附近那些点
          在两个中心之间反复横跳。
        </p>
        <p>
          DBSCAN 的邻域查询是暴力扫一遍，<NoteCode>O(n²)</NoteCode>
          —— 三百个点完全吃得消。真实场景里会换成 k-d 树或球树把它降到
          <NoteCode>O(n log n)</NoteCode>。
        </p>
        <p>
          弧形数据的点是<span className="text-ink">等距</span>铺开再抖动的。
          纯随机取角看着更自然，却会在弧上留下大小不一的空档，最大的那个 往往比
          eps 还宽，于是一条本该连成一片的弧会被断成好几截 ——
          那不是算法的毛病，是采样的毛病。
        </p>
      </NoteSection>
    </>
  );
}
