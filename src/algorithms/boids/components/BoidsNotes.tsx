import {
  NoteCode,
  NoteItem,
  NoteLegend,
  NoteList,
  NoteSection,
  NoteTable,
} from '@/components/notes';

import { forceColors } from '../constants';

/** 页面右侧滑出的原理说明 */
export function BoidsNotes() {
  return (
    <>
      <NoteSection title="三条规则">
        <p>
          点击画布上任意一只鸟，就能看到它的视野扇形、到邻居的连线，
          以及下面这三个力的箭头。
        </p>
        <NoteList>
          <NoteItem term="分离 Separation" color={forceColors.separation}>
            远离靠得太近（小于分离半径）的同伴，避免碰撞。
          </NoteItem>
          <NoteItem term="对齐 Alignment" color={forceColors.alignment}>
            把速度调向视野内同伴的平均速度，保持步调一致。
          </NoteItem>
          <NoteItem term="聚合 Cohesion" color={forceColors.cohesion}>
            朝视野内同伴的重心靠拢，不掉队。
          </NoteItem>
        </NoteList>
        <NoteLegend
          items={[
            { color: forceColors.separation, label: '分离' },
            { color: forceColors.alignment, label: '对齐' },
            { color: forceColors.cohesion, label: '聚合' },
          ]}
        />
      </NoteSection>

      <NoteSection title="一条规则是怎么算出来的">
        <p>
          每条规则先算出一个「期望速度」，减去当前速度得到转向力，再限幅到
          <NoteCode>转向力上限</NoteCode>。限幅是关键 ——
          它让鸟只能平滑转弯，而不是瞬间掉头。三个力按权重求和成加速度，
          积分得到新的速度和位置。
        </p>
        <p>把「转向力上限」调小，整群会显得笨重而有惯性；调大则灵活到失真。</p>
      </NoteSection>

      <NoteSection title="鸟群和鱼群是一回事吗">
        <p>
          算法层面是。Reynolds 原论文就写明这个模型同时适用于 flock（鸟群）、
          herd（兽群）和 school（鱼群），三条规则一字不改。差别全在参数里。
        </p>
        <NoteTable
          head={['', '鸟', '鱼']}
          rows={[
            ['感知', '视觉，后方有盲区', '视觉 + 侧线，近场无盲区'],
            ['最低速度', '必须 > 0，否则失速', '可到 0，能悬停'],
            ['分离', '相对弱', '更强更精确'],
            ['邻居选择', '拓扑（最近 k 个）', '偏度量（按距离）'],
          ]}
        />
        <p>面板顶部的两个物种预设就是这么配出来的，切过去看形态差别。</p>
      </NoteSection>

      <NoteSection title="度量感知 vs 拓扑感知">
        <p>
          这是 Boids 里最容易被忽略、但影响最大的一个选择：
          <span className="text-ink">邻居到底是怎么选出来的</span>。
        </p>
        <NoteList>
          <NoteItem term="度量">
            视野半径内的所有同伴。群体一旦被拉稀疏，邻居数骤减，很容易失联解体。
          </NoteItem>
          <NoteItem term="拓扑">
            固定跟最近的 k 个同伴互动，不管它们多远。密度怎么变，邻居数都不变。
          </NoteItem>
        </NoteList>
        <p>
          2008 年 Ballerini 等人对椋鸟群做三维重建，发现真实的鸟用的是拓扑方式，
          <NoteCode>k ≈ 6–7</NoteCode>
          。这解释了椋鸟群为什么能在被猎隼冲散后迅速重聚 ——
          密度剧变不影响互动结构。想看这个区别：切到拓扑、把数量调低，
          再用捕食者把群冲散，对比两种模式下群体会不会散架。
        </p>
      </NoteSection>

      <NoteSection title="捕食者：三种反应都是涌现的">
        <p>
          把鼠标干预切到「捕食者」，代码里只多做了两件事：近距离放大排斥，
          同时按恐慌程度放大聚合权重。下面三种现象没有任何一种是专门编码的：
        </p>
        <NoteList>
          <NoteItem term="闪散 flash expansion">
            捕食者突然贴近时整片瞬间炸开 —— 排斥项在近距离急剧放大的结果。
          </NoteItem>
          <NoteItem term="喷泉效应 fountain effect">
            慢慢划过群体，个体从两侧绕开、再在身后合拢 ——
            排斥把它们推开，放大的聚合又把它们拉回来。
          </NoteItem>
          <NoteItem term="饵球 bait ball">
            停在群体边缘不动，剩下的个体会抱成密集一团 —— 聚合压过排斥的平衡点。
          </NoteItem>
        </NoteList>
      </NoteSection>

      <NoteSection title="为什么值得看">
        <p>
          没有任何个体知道「群」的存在：每只鸟只能看到视野半径内的几个邻居，
          规则里也没有任何一条提到队形。但把权重调一调，同一套规则就能长出
          迁徙的长队、打转的蜂群或一盘散沙 —— 这就是
          <span className="text-ink">涌现</span>。
        </p>
        <p>
          面板上的<span className="text-ink">极化度</span>量化了这一点：
          它是所有速度方向单位向量的平均长度，越接近 1 说明整群越同向。
          试试四个预设，看这个数字怎么变。
        </p>
      </NoteSection>

      <NoteSection title="实现要点">
        <p>
          朴素实现每帧要两两比较，是 <NoteCode>O(n²)</NoteCode>
          ，几百只就开始掉帧。
          这里把画布切成边长等于视野半径的均匀网格，用计数排序把个体装进格子，
          查邻居只需看周围 9 格，复杂度接近 <NoteCode>O(n)</NoteCode>，
          两千只鸟仍能跑满 60fps。位置和速度用 Float32Array 平铺存储，
          避免每只鸟一个对象带来的 GC 压力。
        </p>
        <p className="text-faint">
          注：为了实现简单，「穿越」边界模式下网格不做环面处理，
          跨边界的邻居暂时看不见，对观感基本没有影响。
        </p>
      </NoteSection>
    </>
  );
}
