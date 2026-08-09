import {
  NoteCode,
  NoteItem,
  NoteLegend,
  NoteList,
  NoteSection,
  NoteTable,
} from '@/components/notes';

import { algorithmLabels, sortColors } from '../constants';

export function SortingNotes() {
  return (
    <>
      <NoteSection title="画布配色">
        <NoteLegend
          items={[
            { color: sortColors.bar, label: '还没处理到的元素' },
            {
              color: sortColors.range,
              label: '当前区间：快排的子段 / 归并的合并段 / 堆区',
            },
            { color: sortColors.active, label: '这一步比较或写入碰到的位置' },
            {
              color: sortColors.focus,
              label: '被盯住的那个：轴 / 当前最小值 / 正在下沉的根',
            },
            { color: sortColors.done, label: '已落在最终位置' },
          ]}
        />
      </NoteSection>

      <NoteSection title="六种算法的产物完全相同">
        <p>
          排完都是同一个升序数组，所以这一页要看的从来不是结果，而是
          <span className="text-ink">代价</span>：比较了多少次、
          往数组里写了多少次。面板底下那两个数字才是主角。
        </p>
        <p>
          「步数」是动画的口径：一次比较或一次搬动各算一步
          （一次交换是一步，但记两次写入）。 把比较和搬动
          <span className="text-ink">同等计价</span>是个刻意的简化：
          真实机器上比较通常比搬运便宜，值越大搬起来越贵，
          这也正是选择排序还有人用的理由。
        </p>
      </NoteSection>

      <NoteSection title="代价表">
        <NoteTable
          head={['算法', '平均', '最坏', '额外空间']}
          rows={[
            ['冒泡', 'n²', 'n²', '1'],
            ['插入', 'n²', 'n²', '1'],
            ['选择', 'n²', 'n²', '1'],
            ['归并', 'n log n', 'n log n', 'n'],
            ['快排', 'n log n', 'n²', 'log n'],
            ['堆排', 'n log n', 'n log n', '1'],
          ]}
        />
        <p>
          注意快排那一行的最坏是 <NoteCode>n²</NoteCode>，而它仍然是实践中
          最常用的一个。原因在常数：它原地、顺序访存、内层循环短。
          堆排最坏有保证却常常跑不过它 —— 每次下沉都在数组里跳着走，
          缓存全不命中。
        </p>
      </NoteSection>

      <NoteSection title="三种平方级，差别不在数量级">
        <NoteList>
          {(['bubble', 'insertion', 'selection'] as const).map(id => (
            <NoteItem key={id} term={algorithmLabels[id].short}>
              {algorithmLabels[id].blurb}
            </NoteItem>
          ))}
        </NoteList>
        <p>
          三个都是 <NoteCode>O(n²)</NoteCode>，但把「随机」跑一遍再对读统计：
          插入的写入约是冒泡的一半（腾位置是写一次，不是换一次），
          而选择的写入是三者里最少的、比较次数却一次也省不掉。
        </p>
      </NoteSection>

      <NoteSection title="换输入，结论就变">
        <p>
          复杂度写在纸上是一个式子，但那个式子对不同输入不是同一件事。
          换掉「数据」那一组的分布，同一个算法的数字会翻几十倍：
        </p>
        <NoteList>
          <NoteItem term="近乎有序">
            插入排序几乎退化成一趟扫描，冒泡靠提前退出也是 ——
            两个「慢算法」在这里能反超快排。
          </NoteItem>
          <NoteItem term="逆序">
            插入与冒泡的比较、写入同时拉满；这一页的快排也一样惨，
            因为它的轴取的是末元素。
          </NoteItem>
          <NoteItem term="少量重复值">
            等值元素一多，Lomuto 划分会把它们全部堆到轴的一侧，切不匀。
            工程实现改用三路划分正是为了这个。
          </NoteItem>
        </NoteList>
        <p>
          这里的快排<span className="text-ink">故意</span>不做三数取中：
          把分布切到「逆序」，看它的比较次数直接跳到 n²/2 那一档 ——
          轴挑得好不好，就是快排的全部。
        </p>
      </NoteSection>

      <NoteSection title="为什么过不了 n log n">
        <p>
          只靠两两比较来排序，本质是在 <NoteCode>n!</NoteCode> 种排列里做
          二分定位：每次比较最多切掉一半可能，所以任何比较排序至少要
          <NoteCode>log₂(n!) ≈ n log₂ n</NoteCode> 次比较。
        </p>
        <p>
          归并和堆排已经贴着这条下界了，剩下的空间只在常数上。
          真要更快就得跳出比较模型 —— 计数排序、基数排序靠的是
          直接拿值当下标，那已经不是同一类算法了。
        </p>
      </NoteSection>

      <NoteSection title="稳定性：柱子上看不见的那一栏">
        <p>
          稳定 = 值相等的两个元素，排完之后相对次序不变。 画布上的柱子只是
          数字，相等就完全一样，所以这件事在这一页
          <span className="text-ink">看不出来</span> ——
          但换成「先按价格排、再按销量排」的记录，它就是全部。
        </p>
        <NoteList>
          <NoteItem term="稳定">归并、插入、冒泡</NoteItem>
          <NoteItem term="不稳定">
            快排、堆排、选择 —— 它们都会把元素跨着一大段距离往回扔，
            相等元素的先后就此打乱
          </NoteItem>
        </NoteList>
      </NoteSection>

      <NoteSection title="实现要点">
        <p>
          六种算法都写成 generator：<NoteCode>yield</NoteCode> 一次就是一步，
          算法本体因此和伪代码逐行对应，不用为了「能中断」手写状态机。
          比较、交换、写入这三个原语统一在 <NoteCode>Sorter</NoteCode> 上，
          计数口径六边一致，对比才成立。
        </p>
        <p>
          堆排的下沉和 <NoteCode>lib/min-heap.ts</NoteCode>
          是同一套机制（那边是最小堆，给三个搜索页当优先队列用）；
          这一页把它摊开在数组上画出来，正好能看清「堆」到底是怎么一回事。
        </p>
      </NoteSection>
    </>
  );
}
