import {
  NoteCode,
  NoteItem,
  NoteLegend,
  NoteList,
  NoteSection,
  NoteTable,
} from '@/components/notes';

import { cellColors } from '../constants';

/** 页面右侧滑出的原理说明 */
export function CellularNotes() {
  return (
    <>
      <NoteSection title="画布配色">
        <NoteLegend
          items={[
            { color: cellColors.young, label: '刚出生' },
            { color: cellColors.mid, label: '活了十几代' },
            { color: cellColors.old, label: '一直没动过' },
            { color: cellColors.decay, label: '刚死的余晖' },
            { color: cellColors.plain, label: '活细胞（关掉年龄着色时）' },
            { color: cellColors.latest, label: '一维时空图的最新一行' },
            { color: cellColors.ghost, label: '图案落点预览' },
          ]}
        />
        <p>
          年龄着色不是装饰：静止的东西会慢慢沉成暗蓝，真正在动的边缘一直
          发亮。满屏几万个格子里，一眼就能挑出还在演化的那几块。
        </p>
      </NoteSection>

      <NoteSection title="整页只有一条规则">
        <p>
          每个格子看自己死活、数一圈八个邻居里有几个活的，然后查表决定下一代。
          就这些。没有全局变量、没有谁指挥谁，也没有随机数 ——
          <span className="text-ink">同样的初始格局永远长出同样的结果</span>。
        </p>
        <p>
          规则写成 <NoteCode>B3/S23</NoteCode>
          ：空格恰好三个邻居就出生（Birth），
          活格有两三个邻居就留下（Survive），其余一律死。右边那两行方块就是
          这两个集合，按一下就换了个宇宙。
        </p>
        <p>
          出生和存活各有九种可能（0 到 8 个邻居），一共 2<sup>18</sup> ={' '}
          <NoteCode>262144</NoteCode> 条规则。绝大多数要么瞬间死光、要么糊成
          一片。有意思的只有很窄的一小撮。
        </p>
      </NoteSection>

      <NoteSection title="B3/S23 卡在两个悬崖之间">
        <p>
          自己动手试：给出生加一条 <NoteCode>B2</NoteCode>，整块画布几秒钟内
          糊成沸腾的噪声；把 <NoteCode>S2</NoteCode> 拿掉，几十代内全灭。
        </p>
        <p>
          Conway 是拿着棋盘一组一组试出来的，目标很明确：既不能爆炸也不能熄火。
          只有卡在中间，结构才有足够长的寿命去做点别的事 —— 这个位置后来被叫作
          <span className="text-ink">混沌边缘</span>。
        </p>
        <NoteTable
          head={['规则', '结果']}
          rows={[
            ['B2/S', '没有细胞活得过一代，却烧遍全屏'],
            ['B3/S23', '既不爆炸也不熄火，能造出机器'],
            ['B3/S45678', '边缘结晶，内部冻住，活跃度掉到 0'],
            ['B3/S012345678', '只生不死，人口单调上涨直到填满'],
          ]}
        />
      </NoteSection>

      <NoteSection title="有限的规则，无上界的人口">
        <p>
          进页面那台机器是<span className="text-ink">高斯帕滑翔机枪</span>： 每
          30 代吐出一架滑翔机，永不停歇。人口没有上界。
        </p>
        <p>
          1970 年 Conway 悬赏 50 美元问有没有这种东西 —— 他倾向于认为没有。Bill
          Gosper 三个月后把这台枪寄了过去。
          规则里没有任何一句提到「飞船」或者「制造」，这两个概念是从
          三十六列字符里长出来的。
        </p>
        <p>
          不过底下那个人口数会停在某个值上 —— 因为这块画布是
          <span className="text-ink">有界</span>
          的，飞到右下角的滑翔机撞墙解体了。 「无上界」说的是无限平面。按{' '}
          <NoteCode>B</NoteCode>
          切成环形试试：滑翔机会从左上角绕回来，四百多代后把枪自己打烂。
        </p>
      </NoteSection>

      <NoteSection title="你只能跑，不能算">
        <p>
          用滑翔机流可以搭出与门、非门、存储器 —— 生命游戏是
          <span className="text-ink">图灵完备</span>的。
          代价是：「这个格局最终会不会安定下来」变成了停机问题的一个化身，
          <span className="text-ink">不可判定</span>。
        </p>
        <p>
          所以「R-五连体在第 1103 代安定」「顽固份子在第 130 代消失」这些数字
          全是跑出来的，不是算出来的。放一个「无限增长」上去，它 5×5
          的样子和会死的图案毫无区别 —— 你没法通过看它来知道结局。
        </p>
        <p>
          底下那行状态读数也一样：它说的是
          <span className="text-ink">观察到了什么</span>，不是预言。
          「演化中」只代表这 64 代里没重复过，不代表它不会停。
        </p>
      </NoteSection>

      <NoteSection title="边界也是规则的一部分">
        <p>
          默认是<span className="text-ink">有界</span>：界外恒为死，于是边上的
          格子只有五个邻居、角上只有三个。同一条规则在边上就成了另一套行为 ——
          珊瑚会贴着墙长，滑翔机撞上去直接解体。
        </p>
        <p>
          换成<span className="text-ink">环形</span>，画布卷成一个甜甜圈，
          左右相接、上下相接，每个格子都拿回完整的八个邻居 ——
          代价是飞出去的东西早晚会从另一头回来撞上自己。
        </p>
        <p>
          同一个格局切换边界再跑一遍，差别往往大得离谱。
          <span className="text-ink">「无限平面」是个理想化假设</span>，
          任何有限画布都在偷偷改规则。
        </p>
      </NoteSection>

      <NoteSection title="一维：把规则整个数完">
        <p>
          降到一维之后，每格只看左邻、自己、右邻 —— 三格两态共八种局面，
          每种指定一个输出，规则总共只有 <NoteCode>2⁸ = 256</NoteCode> 条。
          少到可以一条一条看完。
        </p>
        <p>
          时间画成第二根轴：每代往下堆一行，整张图就是这条规则的全部历史。
          面板上那八个小方块就是规则表，把它们读成二进制就是 Wolfram 编号。
        </p>
        <NoteTable
          head={['编号', '行为']}
          rows={[
            ['250', '二类：一个空心三角，此后什么都不会发生'],
            ['90', '三类：谢尔宾斯基三角，每一层都自相似'],
            ['30', '三类：左边规整，右边彻底混沌'],
            ['110', '四类：规整背景上爬着会碰撞的结构'],
          ]}
        />
        <p>
          Wolfram 把 256 条规则分成四类：归于均一、落进周期、陷入混沌、
          以及既不规整也不混乱的<span className="text-ink">第四类</span>。
          第四类稀少，而有趣的全在那里。
        </p>
      </NoteSection>

      <NoteSection title="三条值得停下来看的">
        <NoteList>
          <NoteItem term="Rule 90">
            下一格 = 左邻居 <NoteCode>XOR</NoteCode> 右邻居。就这一句，
            单个细胞长成谢尔宾斯基三角。它是线性的，第 n 代可以直接用
            帕斯卡三角模 2 算出来 —— 少数几条「能算」的规则之一。
          </NoteItem>
          <NoteItem term="Rule 30">
            同样从一个细胞出发，右半边彻底混沌。它中间那一列被 Mathematica
            拿去当过随机数源 —— 一个完全确定的过程，
            输出却通不过任何一种规律检验。
          </NoteItem>
          <NoteItem term="Rule 110">
            2004 年被 Matthew Cook 证明图灵完备。
            <span className="text-ink">八个二进制位，什么都能算</span>
            —— 和生命游戏一样，也就同样不可判定。
          </NoteItem>
        </NoteList>
      </NoteSection>

      <NoteSection title="Rule 184 是一条马路">
        <p>
          把 1 读成车、0 读成空位，Rule 184 的意思恰好是「前面空着就往前
          开一格，否则原地不动」。它是最简单的交通流模型。
        </p>
        <p>
          把第一行换成随机、密度调到 40%：几十代后所有车流成整齐的斜纹，
          自由通行。调到 60%：永远堵着，堵塞的波纹反而在
          <span className="text-ink">往后传</span>
          —— 和高速上「前面明明没事故却莫名其妙停下来」是同一件事。
        </p>
        <p>
          临界点就在 50%。同一条规则，密度过线前后是两种完全不同的世界，
          这是个相变。
        </p>
      </NoteSection>

      <NoteSection title="实现要点">
        <p>
          <span className="text-ink">整代必须同时更新</span>。写进一块新缓冲、
          算完再整体换过去 —— 要是原地改，先算的格子会影响后算的格子，
          那就成了另一种自动机（异步 CA），滑翔机连走都走不成。
          这是写生命游戏最常见的一个错。
        </p>
        <p>
          绘制不是逐格 <NoteCode>fillRect</NoteCode>：满屏两三万格、每格还要
          按年龄换一次颜色，光是状态切换就能吃掉一半帧率。这里先往
          <NoteCode>ImageData</NoteCode> 里写一张「一格一像素」的小图， 再用{' '}
          <NoteCode>drawImage</NoteCode> 整体放大，关掉插值保住硬边。
        </p>
        <p>
          周期检测用的是 FNV-1a 哈希加逐字节确认，窗口 64 代。
          只靠哈希会误报，而「进入周期 30」这种断言错一次就不能信了。
          窗口之外的长周期一律报「演化中」—— 有限的观察本来也判不了更多。
        </p>
      </NoteSection>
    </>
  );
}
