import {
  NoteCode,
  NoteItem,
  NoteLegend,
  NoteList,
  NoteSection,
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
