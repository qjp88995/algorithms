import { boidShape, canvasColors, forceColors } from './constants';
import type { Flock } from './flock';
import type { BoidsConfig, RenderOptions, Steering } from './types';

export function renderFlock(
  ctx: CanvasRenderingContext2D,
  flock: Flock,
  config: BoidsConfig,
  options: RenderOptions,
  steeringScratch: Steering
) {
  const { width, height } = flock;

  if (options.trails) {
    ctx.fillStyle = canvasColors.trail;
    ctx.fillRect(0, 0, width, height);
  } else {
    ctx.fillStyle = canvasColors.background;
    ctx.fillRect(0, 0, width, height);
  }

  const focus = options.focusIndex;
  if (focus !== null && focus < flock.count) {
    drawFocusContext(ctx, flock, config, focus);
  }

  for (let i = 0; i < flock.count; i++) {
    const vx = flock.vx[i];
    const vy = flock.vy[i];
    const speed = Math.hypot(vx, vy) || 1;
    const dirX = vx / speed;
    const dirY = vy / speed;
    const x = flock.x[i];
    const y = flock.y[i];

    if (i === focus) {
      ctx.fillStyle = canvasColors.focus;
    } else if (options.colorByHeading) {
      const hue = ((Math.atan2(vy, vx) * 180) / Math.PI + 360) % 360;
      ctx.fillStyle = `hsl(${hue.toFixed(0)} 62% 66%)`;
    } else {
      ctx.fillStyle = canvasColors.boid;
    }

    // 一个朝向速度方向的细长三角形
    ctx.beginPath();
    ctx.moveTo(x + dirX * boidShape.length, y + dirY * boidShape.length);
    ctx.lineTo(
      x - dirX * boidShape.length * 0.5 - dirY * boidShape.width,
      y - dirY * boidShape.length * 0.5 + dirX * boidShape.width
    );
    ctx.lineTo(
      x - dirX * boidShape.length * 0.5 + dirY * boidShape.width,
      y - dirY * boidShape.length * 0.5 - dirX * boidShape.width
    );
    ctx.closePath();
    ctx.fill();
  }

  if (focus !== null && focus < flock.count) {
    drawFocusForces(ctx, flock, config, focus, steeringScratch);
  }

  if (config.pointer.active) {
    ctx.strokeStyle =
      config.pointer.mode === 'attract'
        ? canvasColors.attractRing
        : canvasColors.repelRing;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(
      config.pointer.x,
      config.pointer.y,
      config.pointer.radius,
      0,
      Math.PI * 2
    );
    ctx.stroke();
  }
}

/** 视野扇形 + 分离半径 + 到邻居的连线 */
function drawFocusContext(
  ctx: CanvasRenderingContext2D,
  flock: Flock,
  config: BoidsConfig,
  index: number
) {
  const x = flock.x[index];
  const y = flock.y[index];
  const heading = Math.atan2(flock.vy[index], flock.vx[index]);
  const half = (Math.min(config.fieldOfView, 360) * Math.PI) / 360;

  ctx.fillStyle = canvasColors.perception;
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.arc(x, y, config.perceptionRadius, heading - half, heading + half);
  ctx.closePath();
  ctx.fill();

  ctx.strokeStyle = canvasColors.separationRing;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.arc(x, y, config.separationRadius, 0, Math.PI * 2);
  ctx.stroke();

  ctx.strokeStyle = canvasColors.neighborLink;
  ctx.beginPath();
  for (const j of flock.neighborsOf(index, config)) {
    ctx.moveTo(x, y);
    ctx.lineTo(flock.x[j], flock.y[j]);
  }
  ctx.stroke();
}

/** 把三个转向力按权重画成箭头，直观展示"合力是怎么来的" */
function drawFocusForces(
  ctx: CanvasRenderingContext2D,
  flock: Flock,
  config: BoidsConfig,
  index: number,
  scratch: Steering
) {
  const s = flock.computeSteering(index, config, scratch);
  const x = flock.x[index];
  const y = flock.y[index];
  // 转向力单位是 px/s²，直接画会长到出屏，缩放到可读长度
  const scale = 46 / Math.max(config.maxForce, 1);

  drawArrow(
    ctx,
    x,
    y,
    s.sepX * config.separationWeight * scale,
    s.sepY * config.separationWeight * scale,
    forceColors.separation
  );
  drawArrow(
    ctx,
    x,
    y,
    s.aliX * config.alignmentWeight * scale,
    s.aliY * config.alignmentWeight * scale,
    forceColors.alignment
  );
  drawArrow(
    ctx,
    x,
    y,
    s.cohX * config.cohesionWeight * scale,
    s.cohY * config.cohesionWeight * scale,
    forceColors.cohesion
  );
}

function drawArrow(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  dx: number,
  dy: number,
  color: string
) {
  const length = Math.hypot(dx, dy);
  if (length < 2) return;

  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x + dx, y + dy);
  ctx.stroke();

  const ux = dx / length;
  const uy = dy / length;
  const tipX = x + dx;
  const tipY = y + dy;
  ctx.beginPath();
  ctx.moveTo(tipX, tipY);
  ctx.lineTo(tipX - ux * 6 - uy * 3, tipY - uy * 6 + ux * 3);
  ctx.lineTo(tipX - ux * 6 + uy * 3, tipY - uy * 6 - ux * 3);
  ctx.closePath();
  ctx.fill();
}
