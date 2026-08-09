import { describe, expect, it } from 'vitest';

import { generateGeometricGraph } from './generate';
import { findEdge, type GraphModel, nodeName, tracePath } from './model';

function reachableCount(graph: GraphModel, from = 0) {
  const seen = new Uint8Array(graph.nodes.length);
  const stack = [from];
  seen[from] = 1;
  let count = 1;
  while (stack.length > 0) {
    const node = stack.pop()!;
    for (const edge of graph.outgoing[node]) {
      const next = graph.edges[edge].to;
      if (seen[next]) continue;
      seen[next] = 1;
      count++;
      stack.push(next);
    }
  }
  return count;
}

/** 两条线段是否真正相交（共端点不算） */
function segmentsCross(
  graph: GraphModel,
  a: [number, number],
  b: [number, number]
) {
  if (a[0] === b[0] || a[0] === b[1] || a[1] === b[0] || a[1] === b[1]) {
    return false;
  }
  const side = (p: number, q: number, r: number) => {
    const [px, py] = [graph.nodes[p].x, graph.nodes[p].y];
    const [qx, qy] = [graph.nodes[q].x, graph.nodes[q].y];
    const [rx, ry] = [graph.nodes[r].x, graph.nodes[r].y];
    return (qx - px) * (ry - py) - (qy - py) * (rx - px);
  };
  return (
    side(b[0], b[1], a[0]) * side(b[0], b[1], a[1]) < 0 &&
    side(a[0], a[1], b[0]) * side(a[0], a[1], b[1]) < 0
  );
}

describe('generateGeometricGraph', () => {
  it('节点数与种子决定一切 —— 同种子同图', () => {
    const a = generateGeometricGraph({ nodeCount: 12, degree: 3, seed: 7 });
    const b = generateGeometricGraph({ nodeCount: 12, degree: 3, seed: 7 });
    expect(a.nodes).toEqual(b.nodes);
    expect(a.edges).toEqual(b.edges);
  });

  it('换种子换图', () => {
    const a = generateGeometricGraph({ nodeCount: 12, degree: 3, seed: 7 });
    const b = generateGeometricGraph({ nodeCount: 12, degree: 3, seed: 8 });
    expect(a.nodes).not.toEqual(b.nodes);
  });

  it('任意规模都连通 —— 否则终点可能根本到不了', () => {
    for (const nodeCount of [4, 8, 12, 18, 26]) {
      const graph = generateGeometricGraph({ nodeCount, degree: 3, seed: 3 });
      expect(graph.nodes).toHaveLength(nodeCount);
      expect(reachableCount(graph), `n=${nodeCount}`).toBe(nodeCount);
    }
  });

  it('边成对出现，reverse 互相指回去', () => {
    const graph = generateGeometricGraph({ nodeCount: 14, degree: 4, seed: 5 });
    expect(graph.edges.length % 2).toBe(0);
    graph.edges.forEach((edge, index) => {
      const back = graph.edges[edge.reverse];
      expect(back.from).toBe(edge.to);
      expect(back.to).toBe(edge.from);
      expect(back.reverse).toBe(index);
      expect(edge.length).toBeCloseTo(back.length);
    });
  });

  it('节点之间不重叠', () => {
    const graph = generateGeometricGraph({
      nodeCount: 16,
      degree: 3,
      seed: 11,
    });
    for (let a = 0; a < graph.nodes.length; a++) {
      for (let b = a + 1; b < graph.nodes.length; b++) {
        const dist = Math.hypot(
          graph.nodes[a].x - graph.nodes[b].x,
          graph.nodes[a].y - graph.nodes[b].y
        );
        expect(dist).toBeGreaterThan(0.05);
      }
    }
  });

  it('没有交叉的边 —— 画出来才读得懂哪条绕远', () => {
    for (const seed of [1, 2, 3, 4, 5]) {
      const graph = generateGeometricGraph({
        nodeCount: 16,
        degree: 4,
        seed,
      });
      // 每条无向连线只取正向那一条来两两比对
      const links = graph.edges
        .filter((edge, index) => index < edge.reverse)
        .map(edge => [edge.from, edge.to] as [number, number]);
      for (let a = 0; a < links.length; a++) {
        for (let b = a + 1; b < links.length; b++) {
          expect(segmentsCross(graph, links[a], links[b]), `seed=${seed}`).toBe(
            false
          );
        }
      }
    }
  });

  it('平均度数跟着参数走', () => {
    const sparse = generateGeometricGraph({
      nodeCount: 20,
      degree: 2,
      seed: 9,
    });
    const dense = generateGeometricGraph({ nodeCount: 20, degree: 5, seed: 9 });
    expect(dense.edges.length).toBeGreaterThan(sparse.edges.length);
  });
});

describe('图模型辅助函数', () => {
  it('findEdge 找得到正反两条边，找不到时返回 -1', () => {
    const graph = generateGeometricGraph({ nodeCount: 10, degree: 3, seed: 2 });
    const sample = graph.edges[0];
    expect(findEdge(graph, sample.from, sample.to)).toBe(0);
    expect(findEdge(graph, sample.to, sample.from)).toBe(sample.reverse);
    expect(findEdge(graph, sample.from, sample.from)).toBe(-1);
  });

  it('nodeName 超过 26 个之后带上数字后缀', () => {
    expect(nodeName(0)).toBe('A');
    expect(nodeName(25)).toBe('Z');
    expect(nodeName(26)).toBe('A1');
  });

  it('tracePath 回溯父指针；断链和成环都返回空', () => {
    const parent = Int32Array.from([-1, 0, 1, 3]);
    expect(tracePath(parent, 0, 2)).toEqual([0, 1, 2]);
    // 3 的父指针指向自己：环，不该转圈转到死
    expect(tracePath(parent, 0, 3)).toEqual([]);
    expect(tracePath(Int32Array.from([-1, -1]), 0, 1)).toEqual([]);
  });
});
