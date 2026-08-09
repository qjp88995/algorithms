import type { ReactNode } from 'react';

/**
 * 原理说明面板里的排版原语。
 *
 * 说明面板是窄栏（400px 上下），所以这里的取舍都偏向窄栏阅读：
 * 段落不缩进、列表用悬挂缩进、表格只留行分隔线。
 */

export function NoteSection({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="flex flex-col gap-2">
      <h2 className="text-sm font-medium text-ink">{title}</h2>
      <div className="flex flex-col gap-2">{children}</div>
    </section>
  );
}

/** 悬挂缩进的列表，配合 <NoteTerm> 做「术语 —— 解释」的排版 */
export function NoteList({ children }: { children: ReactNode }) {
  return <ul className="flex flex-col gap-1.5">{children}</ul>;
}

export function NoteItem({
  term,
  color,
  children,
}: {
  term?: string;
  /** 给出颜色时在词条前画一个色点，和画布上的配色对应 */
  color?: string;
  children: ReactNode;
}) {
  return (
    <li className="flex gap-2">
      {color ? (
        <span
          className="mt-1.5 size-2 shrink-0 rounded-full"
          style={{ background: color }}
        />
      ) : (
        <span className="mt-2 size-1 shrink-0 rounded-full bg-faint" />
      )}
      <span>
        {term ? <span className="text-ink">{term}</span> : null}
        {term ? ' —— ' : null}
        {children}
      </span>
    </li>
  );
}

/** 行内公式或标识符 */
export function NoteCode({ children }: { children: ReactNode }) {
  return (
    <code className="rounded bg-raised px-1 py-0.5 font-mono text-xs text-ink">
      {children}
    </code>
  );
}

export function NoteTable({
  head,
  rows,
}: {
  head: string[];
  rows: ReactNode[][];
}) {
  return (
    <div className="-mx-1 overflow-x-auto">
      <table className="w-full border-collapse text-left">
        <thead>
          <tr>
            {head.map(cell => (
              <th
                key={cell}
                className="border-b border-line px-1 pb-1 text-xs font-normal text-faint"
              >
                {cell}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr key={index} className="border-b border-line/60 last:border-0">
              {row.map((cell, cellIndex) => (
                <td key={cellIndex} className="px-1 py-1.5 align-top">
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** 画布配色图例：读说明时能立刻对上画面里的颜色 */
export function NoteLegend({
  items,
}: {
  items: { color: string; label: string }[];
}) {
  return (
    <div className="flex flex-wrap gap-x-4 gap-y-1.5">
      {items.map(item => (
        <span key={item.label} className="flex items-center gap-1.5 text-xs">
          <span
            className="size-3 shrink-0 rounded-sm"
            style={{ background: item.color }}
          />
          {item.label}
        </span>
      ))}
    </div>
  );
}
