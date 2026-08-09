import {
  type ClusterRun,
  DbscanRun,
  HierarchicalRun,
  KMeansRun,
} from './cluster';
import { clusterColor, clusterColors } from './constants';
import type { Dataset } from './dataset';

/** 归一化坐标 → 画布像素。数据是 [0,1]²，所以取一个居中的正方形 */
export interface ClusterViewport {
  size: number;
  offsetX: number;
  offsetY: number;
  /** 一个点画多大 */
  radius: number;
}

export function computeViewport(
  width: number,
  height: number,
  pointCount: number
): ClusterViewport {
  const padding = 14;
  const size = Math.max(1, Math.min(width, height) - padding * 2);
  return {
    size,
    offsetX: (width - size) / 2,
    offsetY: (height - size) / 2,
    // 点多就画小一点，否则挤成一片看不出密度差异
    radius: clamp(size / Math.sqrt(Math.max(pointCount, 1)) / 3.6, 2.2, 5),
  };
}

export interface RenderParams {
  data: Dataset;
  run: ClusterRun | null;
  view: ClusterViewport;
  width: number;
  height: number;
  /** 把真实分组画成每个点的描边 */
  showTruth: boolean;
  pulse: number;
}

/**
 * 一屏点云。
 *
 * 填充色是**算法给的簇**，打开对照后描边色是**真实分组** ——
 * 两者不一致的点，就是算法分错的地方。这比盯着一个吻合度数字直观得多：
 * K-means 在月牙上那条笔直的错误边界，一眼就能看见。
 */
export function renderScene(
  ctx: CanvasRenderingContext2D,
  params: RenderParams
) {
  ctx.fillStyle = clusterColors.background;
  ctx.fillRect(0, 0, params.width, params.height);

  drawMerges(ctx, params);
  drawTrails(ctx, params);
  drawPoints(ctx, params);
  drawReach(ctx, params);
  drawCenters(ctx, params);
}

function screenX(params: RenderParams, point: number) {
  return params.view.offsetX + params.data.points[point * 2] * params.view.size;
}

function screenY(params: RenderParams, point: number) {
  return (
    params.view.offsetY + params.data.points[point * 2 + 1] * params.view.size
  );
}

function drawPoints(ctx: CanvasRenderingContext2D, params: RenderParams) {
  const { data, run, view, showTruth } = params;
  const dbscan = run instanceof DbscanRun ? run : null;
  const cursor = cursorOf(run);

  for (let point = 0; point < data.truth.length; point++) {
    const x = screenX(params, point);
    const y = screenY(params, point);
    const label = run ? run.labels[point] : -1;
    const untouched = !run || (label < 0 && isPending(run, point));

    ctx.fillStyle = untouched
      ? clusterColors.pending
      : label < 0
        ? clusterColors.noise
        : clusterColor(label);

    // DBSCAN 的边界点画成空心：它挨着核心点，但自己周围并不稠密
    const hollow = dbscan !== null && label >= 0 && dbscan.core[point] === 0;
    ctx.beginPath();
    ctx.arc(x, y, view.radius, 0, Math.PI * 2);
    if (hollow) {
      ctx.strokeStyle = ctx.fillStyle;
      ctx.lineWidth = 1.5;
      ctx.stroke();
    } else {
      ctx.fill();
    }

    if (showTruth && data.truth[point] >= 0) {
      // 描边是真值：填充和描边对不上的点，就是分错的
      ctx.strokeStyle = clusterColor(data.truth[point]);
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(x, y, view.radius + 2.5, 0, Math.PI * 2);
      ctx.stroke();
    }

    if (point === cursor) {
      ctx.strokeStyle = clusterColors.cursor;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(x, y, view.radius + 4, 0, Math.PI * 2);
      ctx.stroke();
    }
  }
}

/** DBSCAN 正在查的那个邻域 */
function drawReach(ctx: CanvasRenderingContext2D, params: RenderParams) {
  const { run, view } = params;
  if (!(run instanceof DbscanRun) || run.cursor < 0) return;

  const x = screenX(params, run.cursor);
  const y = screenY(params, run.cursor);

  ctx.strokeStyle = clusterColors.reach;
  ctx.globalAlpha = 0.75;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(x, y, run.config.eps * view.size, 0, Math.PI * 2);
  ctx.stroke();

  // 圈里的点连出去 —— 数得出来有几个，也就看得出为什么够不够 minPts
  ctx.globalAlpha = 0.35;
  ctx.beginPath();
  for (const other of run.neighborhood) {
    ctx.moveTo(x, y);
    ctx.lineTo(screenX(params, other), screenY(params, other));
  }
  ctx.stroke();
  ctx.globalAlpha = 1;
}

/** K-means 的中心，以及它一路挪过来的轨迹 */
function drawCenters(ctx: CanvasRenderingContext2D, params: RenderParams) {
  const { run, view, pulse } = params;
  if (!(run instanceof KMeansRun)) return;

  // 正在分配的那个点连一条线到它认领的中心
  if (run.cursor >= 0) {
    const label = run.labels[run.cursor];
    if (label >= 0) {
      ctx.strokeStyle = clusterColors.cursor;
      ctx.globalAlpha = 0.6;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(screenX(params, run.cursor), screenY(params, run.cursor));
      ctx.lineTo(
        view.offsetX + run.centers[label * 2] * view.size,
        view.offsetY + run.centers[label * 2 + 1] * view.size
      );
      ctx.stroke();
      ctx.globalAlpha = 1;
    }
  }

  const size = Math.max(7, view.radius * 2.2);
  for (let center = 0; center < run.k; center++) {
    const x = view.offsetX + run.centers[center * 2] * view.size;
    const y = view.offsetY + run.centers[center * 2 + 1] * view.size;

    ctx.fillStyle = clusterColor(center);
    ctx.strokeStyle = clusterColors.center;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x, y - size);
    ctx.lineTo(x + size, y);
    ctx.lineTo(x, y + size);
    ctx.lineTo(x - size, y);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    if (run.done) continue;
    ctx.strokeStyle = clusterColors.center;
    ctx.globalAlpha = 0.35 + 0.35 * Math.sin(pulse * 0.09);
    ctx.beginPath();
    ctx.arc(x, y, size + 5, 0, Math.PI * 2);
    ctx.stroke();
    ctx.globalAlpha = 1;
  }
}

function drawTrails(ctx: CanvasRenderingContext2D, params: RenderParams) {
  const { run, view } = params;
  if (!(run instanceof KMeansRun)) return;

  ctx.strokeStyle = clusterColors.trail;
  ctx.lineWidth = 1.5;
  for (const trail of run.trails) {
    if (trail.length < 4) continue;
    ctx.beginPath();
    for (let i = 0; i < trail.length; i += 2) {
      const x = view.offsetX + trail[i] * view.size;
      const y = view.offsetY + trail[i + 1] * view.size;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
  }
}

/**
 * 层次聚类已经发生过的合并。
 *
 * 每条线连着两个当时的簇心，越晚合并的越亮 —— 这就是树状图躺平之后
 * 的样子：早期那些短线是点在抱团，最后那几条长线才是「大结构」。
 */
function drawMerges(ctx: CanvasRenderingContext2D, params: RenderParams) {
  const { run, view } = params;
  if (!(run instanceof HierarchicalRun) || run.merges.length === 0) return;

  const total = run.merges.length;
  ctx.strokeStyle = clusterColors.merge;
  ctx.lineWidth = 1;
  run.merges.forEach((merge, index) => {
    ctx.globalAlpha = 0.15 + 0.55 * (index / total);
    ctx.beginPath();
    ctx.moveTo(
      view.offsetX + merge.ax * view.size,
      view.offsetY + merge.ay * view.size
    );
    ctx.lineTo(
      view.offsetX + merge.bx * view.size,
      view.offsetY + merge.by * view.size
    );
    ctx.stroke();
  });
  ctx.globalAlpha = 1;
}

function cursorOf(run: ClusterRun | null) {
  if (run instanceof DbscanRun) return run.cursor;
  if (run instanceof KMeansRun) return run.cursor;
  return -1;
}

/**
 * 这个点还没被算法处理到 —— 和「已经判成噪声」是两回事。
 * 只有 DBSCAN 会把点判成噪声，另外两个的 -1 一律是「还没轮到」。
 */
function isPending(run: ClusterRun, point: number) {
  if (run instanceof DbscanRun) return run.visited[point] === 0;
  return true;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}
