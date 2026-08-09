import { NoteSection } from '@/components/AlgorithmPage';

/** 页面下方的原理说明 */
export function BoidsNotes() {
  return (
    <div className="max-w-3xl">
      <NoteSection title="三条规则">
        <ul className="ml-4 list-disc space-y-1">
          <li>
            <strong className="text-ink">分离 Separation</strong>
            ：远离靠得太近（小于分离半径）的同伴，避免碰撞。
          </li>
          <li>
            <strong className="text-ink">对齐 Alignment</strong>
            ：把速度调向视野内同伴的平均速度，保持步调一致。
          </li>
          <li>
            <strong className="text-ink">聚合 Cohesion</strong>
            ：朝视野内同伴的重心靠拢，不掉队。
          </li>
        </ul>
        <p className="mt-2">
          每条规则先算出一个「期望速度」，减去当前速度得到转向力，再限幅到「转向力上限」——
          限幅是关键，它让鸟只能平滑转弯而不是瞬移掉头。三个力按权重求和成加速度，积分得到新的速度和位置。
        </p>
      </NoteSection>

      <NoteSection title="为什么值得看">
        <p>
          没有任何个体知道「群」的存在：每只鸟只能看到视野半径内的几个邻居，
          规则里也没有任何一条提到队形。但把权重调一调，同一套规则就能长出迁徙的长队、
          打转的蜂群或一盘散沙 —— 这就是
          <strong className="text-ink">涌现</strong>
          。右侧的「极化度」量化了这一点：它是所有速度方向单位向量的平均长度，
          越接近 1 说明整群越同向。
        </p>
      </NoteSection>

      <NoteSection title="实现要点">
        <p>
          朴素实现每帧要两两比较，是
          O(n²)，几百只就开始掉帧。这里把画布切成边长等于
          视野半径的均匀网格，用计数排序把个体装进格子，查邻居只需看周围 9 格，
          复杂度接近 O(n)，两千只鸟仍能跑满 60fps。位置和速度用 Float32Array
          平铺存储，避免每只鸟一个对象带来的 GC 压力。
        </p>
        <p className="mt-2 text-faint">
          注：为了实现简单，「穿越」边界模式下网格不做环面处理，跨边界的邻居暂时看不见，
          对观感基本没有影响。
        </p>
      </NoteSection>
    </div>
  );
}
