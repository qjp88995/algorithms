import { describe, expect, it } from 'vitest';

import { DisjointSet } from './disjoint-set';

describe('DisjointSet', () => {
  it('一开始每个元素自成一集', () => {
    const dsu = new DisjointSet(5);
    expect(dsu.count).toBe(5);
    for (let i = 0; i < 5; i++) expect(dsu.find(i)).toBe(i);
    expect(dsu.connected(0, 1)).toBe(false);
  });

  it('合并具有传递性，集合数跟着减少', () => {
    const dsu = new DisjointSet(6);
    expect(dsu.union(0, 1)).toBe(true);
    expect(dsu.union(1, 2)).toBe(true);
    expect(dsu.connected(0, 2)).toBe(true);
    expect(dsu.count).toBe(4);
    expect(dsu.connected(0, 3)).toBe(false);
  });

  it('重复合并返回 false，也不会把集合数越减越少', () => {
    const dsu = new DisjointSet(4);
    expect(dsu.union(0, 1)).toBe(true);
    expect(dsu.union(1, 0)).toBe(false);
    expect(dsu.union(0, 0)).toBe(false);
    expect(dsu.count).toBe(3);
  });

  it('连成一条长链之后仍然只有一个代表', () => {
    const size = 1000;
    const dsu = new DisjointSet(size);
    for (let i = 1; i < size; i++) dsu.union(i - 1, i);
    expect(dsu.count).toBe(1);
    const root = dsu.find(0);
    for (let i = 0; i < size; i++) expect(dsu.find(i)).toBe(root);
  });
});
