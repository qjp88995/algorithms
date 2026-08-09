import {
  NoteCode,
  NoteItem,
  NoteLegend,
  NoteList,
  NoteSection,
  NoteTable,
} from '@/components/notes';

import { sandColors } from '../constants';
import { EMPTY, MATERIALS } from '../materials';
import { CHUNK } from '../sand';

/** 页面右侧滑出的原理说明 */
export function SandNotes() {
  return (
    <>
      <NoteSection title="画布配色">
        <NoteLegend
          items={[
            ...MATERIALS.filter(item => item.id !== EMPTY).map(item => ({
              color: item.color,
              label: item.name,
            })),
            { color: sandColors.chunkActive, label: '本帧在算的块' },
            { color: sandColors.chunkIdle, label: '睡着的块' },
          ]}
        />
        <p>
          每一格的亮度都带一点随机抖动，而且这点抖动是它出生时掷的、
          搬家时跟着走 —— 沙子的颗粒感来自这里。 火、烟、蒸汽的颜色则按
          <span className="text-ink">剩余寿命</span>
          取：火自己会从亮黄烧到暗红，烟一路淡进背景。
          没有粒子系统，就是一张查找表。
        </p>
      </NoteSection>

      <NoteSection title="一格像素的全部身份">
        <p>
          世界是一张 <NoteCode>Uint8Array</NoteCode>，一格存一个材质编号。
          没有流体方程、没有受力分析、没有压强求解。每帧从下往上扫一遍，
          每格按自己的类别问几句「下面能不能去」，能去就把两格
          <span className="text-ink">交换</span>。
        </p>
        <p>
          这套东西在 Noita 里叫 Falling Everything 引擎，那一整个游戏 ——
          能被烧穿的木箱、会淹死你的水、爆炸掀掉的半座山 ——
          都是从这几句话里长出来的。
        </p>
      </NoteSection>

      <NoteSection title="四条运动规则，就这些">
        <NoteTable
          head={['类别', '每帧做什么']}
          rows={[
            ['固体', '什么都不做'],
            ['粉末', '试正下方 → 试左下 / 右下（先试哪边掷硬币）'],
            ['液体', '粉末那三步 → 找一个「底下能走」的落点，朝它挪几格'],
            ['气体', '把液体整个上下颠倒，再加一点随机横飘'],
          ]}
        />
        <p>
          沙堆的<span className="text-ink">坡度</span>
          不是参数，是「只肯走左下右下、不肯走正左正右」的直接后果。
        </p>
        <p>
          液体那一行难在<span className="text-ink">横着挪几格</span>
          ：这个数一头连着两个相反的毛病。
        </p>
        <p>
          「旁边空着就挪几格」是错的。同一高度上的长距离平移什么都没改变 ——
          高度没降、低洼没填。于是孤零零浮在液面上的一格水每帧随机往一边弹
          几格，把水面搅成一排
          <span className="text-ink">周期恰好等于这个数</span>
          的锯齿，而且停不下来：形状不再变化，水却一直在跳。
        </p>
        <p>
          可完全禁掉同层移动也不行。液面顶上总有一层填不满整格的水，相邻两级
          只差一格时，「这边六格那边五格」和反过来在能量上完全等价 ——
          没有任何局部规则推得动它们，水面会永久卡成
          <span className="text-ink">一级级一格高的台阶</span>。
        </p>
        <p>
          所以分三档：视野里找得到「底下是空的」落点，朝它走几格（真的往低处
          流）；头上还压着同类液体，可以横着铺开几格（压力驱动）；剩下的
          <span className="text-ink">只许挪一格</span>
          —— 那一点随机游走正是把顶层零头摊匀的唯一办法。 代价是
          <span className="text-ink">液面永远不会完全静止</span>
          ，而真实的水面本来也一直在动。
        </p>
      </NoteSection>

      <NoteSection title="没有一行代码写着「油浮在水上」">
        <p>
          分层来自两个数的比较：往下走要比对方重，往上浮要比对方轻。
          油比水轻，于是水每一帧都在往下钻、把油顶上去。 切到
          <span className="text-ink">油水分层</span>
          场景看 —— 油是故意放在水下面的。
        </p>
        <NoteTable
          head={['材质', '密度']}
          rows={MATERIALS.filter(
            item => item.kind === 'powder' || item.kind === 'liquid'
          ).map(item => [item.name, String(item.density)])}
        />
        <p>
          粉末和固体一律钻不过去 —— 沙堆能挡住水就靠这一句。
          而沙能沉进水里，是因为它比水重。
        </p>
      </NoteSection>

      <NoteSection title="反应表只有两条">
        <NoteTable
          head={['碰上', '各自变成']}
          rows={[
            ['水 + 火', '蒸汽 + 消失'],
            ['水 + 岩浆', '蒸汽 + 石头'],
          ]}
        />
        <p>
          「木头会烧」「油一点就着」不在这张表里 —— 它们是从材质自己的
          <NoteCode>flammability</NoteCode>
          派生出来的：凡是能烧的东西，自动获得「碰到火」和「碰到岩浆」两条规则。
          加一种可燃材质只要填一个数。
        </p>
        <p>
          第二条那个概率不只是「多久反应一次」，它单独决定了岩浆入水的
          <span className="text-ink">形状</span>
          ：凝固发生在接触面上，而石头挡水 —— 凝得越快，岩浆越早给自己糊出
          一层隔热壳。调到 0.35 它一碰水面就整坨卡住结成壳，还会把两成岩浆
          永久封在里面；现在的 0.08 才真的沉得下去，边沉边凝，在水里拉出一条
          石头柱。<span className="text-ink">一个数，两种地质</span>。
        </p>
        <p>
          反过来说，<span className="text-ink">石头和沙点不着</span>
          ：它们的可燃性是 0，压根不进这张表，内核里连四邻检查都整个跳过。
          笔刷也帮不了你 —— 会流动的东西只落在空格里，
          拿火在石墙上刷不会把墙变成火。想烧只能靠规则。
        </p>
        <p>
          还有一条不在表里、却让整套燃烧成立的规则：
          <span className="text-ink">火贴着燃料时既不飘走也不老化</span>。
          火是气体，每帧都往上跑；木头一着火就整格变成火焰，火苗当帧就升空 ——
          燃料还在，点火的人却跑了，于是一根木条只会烧穿火源正头顶那一段。
          按住它，火才会顺着木头一路烧过去，烧到没东西可烧才熄。
        </p>
        <p>
          <span className="text-ink">火山</span>场景把三条链在了一起：
          岩浆滴到木头上点火 → 烧穿 → 掉进水里凝成石头 →
          激起的蒸汽升到顶上、活够寿命凝回水，于是真的下雨。
          这条链没有任何人编排过。
        </p>
      </NoteSection>

      <NoteSection title="脏块：这一页真正的主角">
        <p>
          世界切成{' '}
          <NoteCode>
            {CHUNK}×{CHUNK}
          </NoteCode>{' '}
          的块，每块记一个「上一帧有没有像素动过」。 没动过的整块跳过 ——
          一屏静止的石头、沉到底的水，一格都不算。
        </p>
        <p>
          打开<span className="text-ink">显示块边框</span>看：沙漏跑到后半段，
          三百多个块里通常只剩十几个亮着。再关掉
          <span className="text-ink">脏块跳过</span>，底下的 fps 会当场掉下去 ——
          这就是它省掉的东西。
        </p>
        <p>
          代价是一条必须守住的约束：
          <span className="text-ink">规则能看多远，唤醒就得能传多远</span>。
          一格像素动了，得叫醒周围一整圈的块 —— 液体找落点的视野是一个块宽，
          所以块正中间的一格变了，也可能让隔壁块里某格水动起来。
        </p>
        <p>
          违反它的 bug 极难认，因为画面上看不出跟脏块有任何关系：液面卡成
          一道阶梯、挖开的坑再也不填平。而你一把
          <span className="text-ink">脏块跳过</span>
          关掉，同样一锅水立刻又流起来 —— 这就是那句判据：
          <span className="text-ink">脏块跳过只该省时间，不该改结果</span>。
          两边跑出来的稳态必须一模一样。
        </p>
      </NoteSection>

      <NoteSection title="扫描顺序本身就是规则">
        <p>
          <span className="text-ink">自底向上</span>
          ：先处理最底下那粒，它让出的位置正好给上面一粒，一柱沙整体下移。
          反过来从上往下扫，上面那粒每次都被下面还没走的同伴挡住 ——
          整柱卡住，只能从底部一粒一粒漏，看着像在融化。
          右边的开关可以当场对调。
        </p>
        <p>
          <span className="text-ink">水平方向</span>
          也有偏差：固定从左往右扫，每粒沙的左邻居总是先被处理，
          整堆沙子会集体朝一侧漂、堆出来的坡一边陡一边缓。
          解法是每帧翻转一次扫描方向，把偏差在时间上摊平。
        </p>
        <p>
          另外每格还记着「最后处理它的那一帧」。少了这一笔，一粒沙会被自己
          刚落到的新位置再捞起来一次，同一帧里一路掉到底 ——
          看到的就不是下落而是瞬移了。
        </p>
      </NoteSection>

      <NoteSection title="它的水是假的">
        <p>
          这里的水没有压强、没有不可压缩性，只有「比你重就往下钻」和
          「下不去就往两边挤」。所以
          <span className="text-ink">连通器不会等高</span>
          ：拿石头隔出两个相通的槽，水位不会自己找平到同一高度。
        </p>
        <p>
          扰动传得多快，是<span className="text-ink">水深</span>
          说了算的，跟「一帧横着挪几格」没关系：挖开一处水面，水以四十五度
          角塌进去，所以一帧传出去的距离约等于水深。二十格深的池子，两百格
          外的水十几帧就开始跟着降 —— 六分之一秒，看着就像整片一起塌下去。
        </p>
        <p>
          想看清「最近的水先补上，再一圈圈传出去」，
          <span className="text-ink">把模拟速度调慢</span>
          ：满速是每秒六十步，调到个位数，那十几帧就摊成好几秒。 按{' '}
          <NoteCode>S</NoteCode> 一帧一帧走也行。 再不然把水弄浅 ——
          三格深时，二十五格外要等三十多帧才动。
        </p>
        <p>
          Noita 也是这么做的，而且是刻意的取舍：真正的流体求解要迭代解方程，
          换来的是每帧几百万像素跑不动。
          这套规则每格只做几次比较和一次交换，代价低到可以把整个世界都拿来模拟。
        </p>
      </NoteSection>

      <NoteSection title="Noita 还做了、这里没做的">
        <NoteList>
          <NoteItem term="棋盘着色多线程">
            一格的更新只影响八邻域，所以把块按四色棋盘分组、同色块互不相邻，
            就能无锁并行，一帧跑四轮。浏览器里这是单线程 JS，没有这张牌。
          </NoteItem>
          <NoteItem term="像素 ↔ 刚体">
            用 Marching Squares 从像素区域抠出轮廓、简化、三角化，丢给
            物理引擎当刚体，每帧再把刚体的像素烧回网格。
            木箱被烧断时重新抠一次轮廓，自然裂成两块。
          </NoteItem>
          <NoteItem term="世界流式加载">
            只有玩家周围的块留在内存里，远处的序列化到磁盘。
            于是那张地图可以一直往下挖。
          </NoteItem>
          <NoteItem term="确定性">
            整个模拟走固定种子，同样的输入必然给出同样的世界 —— 这既是它
            speedrun 生态的基础，也是它联机做得极其痛苦的原因。
          </NoteItem>
        </NoteList>
      </NoteSection>

      <NoteSection title="实现要点">
        <p>
          绘制不是逐格 <NoteCode>fillRect</NoteCode>：一屏十几万格，光是换
          fillStyle 就能把帧率吃干净。这里先往 <NoteCode>ImageData</NoteCode>
          里写一张「一格一像素」的小图，再用 <NoteCode>drawImage</NoteCode>
          整体放大，关掉插值保住硬边。
        </p>
        <p>
          材质、颜色抖动、寿命全部是并行的 <NoteCode>Uint8Array</NoteCode>，
          规则表也摊平成定长数组 —— 每帧几十万次查询，热路径上一次字符串
          比较都不能有。
        </p>
        <p>
          交换两格时，颜色抖动和寿命必须跟着材质一起走。
          要是每帧现掷随机数，整片沙会像电视雪花一样闪 ——
          这是写落沙最容易踩的一个坑。
        </p>
      </NoteSection>
    </>
  );
}
