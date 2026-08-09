import { EDGE_MARGIN, FLOCK_CAPACITY } from './constants';
import type { BoidsConfig, FlockMetrics, Steering } from './types';

/**
 * 群鸟算法（Boids，Craig Reynolds 1986）的模拟内核。
 *
 * 没有任何全局指挥者：每一帧、每一只鸟只根据"视野半径内的邻居"
 * 计算三个转向力 —— 分离（别撞上）、对齐（跟大家同向）、
 * 聚合（别掉队），加权求和后积分。群体形态完全是涌现出来的。
 *
 * 性能上有两点值得注意：
 *  1. 位置和速度用 Float32Array 平铺存储（SoA），避免每只鸟一个对象；
 *  2. 邻居查找用均匀网格 + 计数排序，把朴素的 O(n²) 降到接近 O(n)，
 *     所以几千只鸟也能跑满 60fps。
 *
 * 内核不碰 canvas、不碰 React，纯数值计算，方便单元测试。
 */

export class Flock {
  readonly capacity: number;
  count = 0;
  width: number;
  height: number;

  readonly x: Float32Array;
  readonly y: Float32Array;
  readonly vx: Float32Array;
  readonly vy: Float32Array;

  private readonly random: () => number;

  // ─── 均匀网格（每帧重建，计数排序，无堆分配）───────────────
  private cols = 0;
  private rows = 0;
  private cellSize = 1;
  private cellOf: Int32Array;
  private cellStart: Int32Array = new Int32Array(1);
  private cellItems: Int32Array;
  private cursor: Int32Array = new Int32Array(1);
  /** 位置变动后置位，下次查询前重建网格 */
  private gridDirty = true;

  /** 上一帧的邻居总数，用于统计 */
  private neighborTotal = 0;

  /** step 内复用的临时对象，避免每帧分配 */
  private readonly scratch: Steering = {
    sepX: 0,
    sepY: 0,
    aliX: 0,
    aliY: 0,
    cohX: 0,
    cohY: 0,
    neighbors: 0,
  };

  constructor(options: {
    width: number;
    height: number;
    count: number;
    capacity?: number;
    random?: () => number;
  }) {
    this.width = options.width;
    this.height = options.height;
    this.capacity = Math.max(options.capacity ?? FLOCK_CAPACITY, options.count);
    this.random = options.random ?? Math.random;

    this.x = new Float32Array(this.capacity);
    this.y = new Float32Array(this.capacity);
    this.vx = new Float32Array(this.capacity);
    this.vy = new Float32Array(this.capacity);
    this.cellOf = new Int32Array(this.capacity);
    this.cellItems = new Int32Array(this.capacity);

    this.setCount(options.count);
  }

  /** 画布尺寸变化：把越界的个体拉回可视区域 */
  resize(width: number, height: number) {
    this.width = Math.max(1, width);
    this.height = Math.max(1, height);
    for (let i = 0; i < this.count; i++) {
      this.x[i] = Math.min(this.x[i], this.width);
      this.y[i] = Math.min(this.y[i], this.height);
    }
    this.gridDirty = true;
  }

  /** 增减数量：已有个体保持原状，只随机生成新增的那些 */
  setCount(next: number) {
    const target = Math.max(0, Math.min(this.capacity, Math.floor(next)));
    for (let i = this.count; i < target; i++) this.spawn(i);
    this.count = target;
    this.gridDirty = true;
  }

  /** 全部重新随机撒点 */
  reset(count = this.count) {
    this.count = 0;
    this.setCount(count);
  }

  private spawn(i: number) {
    const angle = this.random() * Math.PI * 2;
    const speed = 60 + this.random() * 60;
    this.x[i] = this.random() * this.width;
    this.y[i] = this.random() * this.height;
    this.vx[i] = Math.cos(angle) * speed;
    this.vy[i] = Math.sin(angle) * speed;
  }

  /**
   * 推进一帧。dt 单位是秒，调用方应做上限截断（例如切后台回来时
   * dt 可能很大），否则一步会跨越太远，模拟直接炸开。
   */
  step(dt: number, config: BoidsConfig) {
    if (this.count === 0) return;

    this.ensureGrid(config);
    this.neighborTotal = 0;

    const {
      separationWeight,
      alignmentWeight,
      cohesionWeight,
      maxSpeed,
      minSpeed,
      maxForce,
      edgeMode,
      pointer,
    } = config;

    for (let i = 0; i < this.count; i++) {
      const s = this.computeSteering(i, config, this.scratch);
      this.neighborTotal += s.neighbors;

      let ax = s.sepX * separationWeight + s.aliX * alignmentWeight;
      let ay = s.sepY * separationWeight + s.aliY * alignmentWeight;
      ax += s.cohX * cohesionWeight;
      ay += s.cohY * cohesionWeight;

      if (pointer.active) {
        const dx = pointer.x - this.x[i];
        const dy = pointer.y - this.y[i];
        const dist = Math.hypot(dx, dy);
        if (dist > 0.001 && dist < pointer.radius) {
          // 越靠近作用越强，符号决定吸引还是驱散
          const falloff = 1 - dist / pointer.radius;
          const sign = pointer.mode === 'attract' ? 1 : -1;
          const scale = (sign * pointer.strength * maxForce * falloff) / dist;
          ax += dx * scale;
          ay += dy * scale;
        }
      }

      if (edgeMode === 'bounce') {
        // 靠近边界时施加一个向内的转向力，比硬反弹自然得多
        const turn = maxForce * 1.6;
        if (this.x[i] < EDGE_MARGIN) ax += turn;
        else if (this.x[i] > this.width - EDGE_MARGIN) ax -= turn;
        if (this.y[i] < EDGE_MARGIN) ay += turn;
        else if (this.y[i] > this.height - EDGE_MARGIN) ay -= turn;
      }

      let nvx = this.vx[i] + ax * dt;
      let nvy = this.vy[i] + ay * dt;

      const speed = Math.hypot(nvx, nvy);
      if (speed > maxSpeed) {
        nvx = (nvx / speed) * maxSpeed;
        nvy = (nvy / speed) * maxSpeed;
      } else if (speed < minSpeed) {
        if (speed < 0.001) {
          // 速度归零会丢失方向，随便给一个，避免出现 NaN
          const angle = this.random() * Math.PI * 2;
          nvx = Math.cos(angle) * minSpeed;
          nvy = Math.sin(angle) * minSpeed;
        } else {
          nvx = (nvx / speed) * minSpeed;
          nvy = (nvy / speed) * minSpeed;
        }
      }

      this.vx[i] = nvx;
      this.vy[i] = nvy;
      this.x[i] += nvx * dt;
      this.y[i] += nvy * dt;

      this.applyEdges(i, edgeMode);
    }

    // 位置已经变了：渲染和聚焦查询会先重建网格再用。
    // 注意本帧内部是就地更新的，先算的鸟已经挪了位置，
    // 后算的鸟看到的是"新旧混合"的邻居 —— 这是 Boids 实现里
    // 常见的取舍，省掉一份双缓冲，视觉上没有可察觉的差别。
    this.gridDirty = true;
  }

  private applyEdges(i: number, mode: BoidsConfig['edgeMode']) {
    const w = this.width;
    const h = this.height;
    if (mode === 'wrap') {
      if (this.x[i] < 0) this.x[i] += w;
      else if (this.x[i] >= w) this.x[i] -= w;
      if (this.y[i] < 0) this.y[i] += h;
      else if (this.y[i] >= h) this.y[i] -= h;
      return;
    }
    // bounce：转向力兜不住时（例如刚 resize 完）做一次硬反弹
    if (this.x[i] < 0) {
      this.x[i] = 0;
      this.vx[i] = Math.abs(this.vx[i]);
    } else if (this.x[i] > w) {
      this.x[i] = w;
      this.vx[i] = -Math.abs(this.vx[i]);
    }
    if (this.y[i] < 0) {
      this.y[i] = 0;
      this.vy[i] = Math.abs(this.vy[i]);
    } else if (this.y[i] > h) {
      this.y[i] = h;
      this.vy[i] = -Math.abs(this.vy[i]);
    }
  }

  /**
   * 计算第 i 只鸟的三个转向力（Reynolds 的 steer = desired - velocity 形式，
   * 每条规则单独限幅到 maxForce）。结果写进 out 并返回，避免分配。
   */
  computeSteering(i: number, config: BoidsConfig, out: Steering): Steering {
    this.ensureGrid(config);
    const {
      perceptionRadius,
      separationRadius,
      fieldOfView,
      maxSpeed,
      maxForce,
    } = config;

    const perception2 = perceptionRadius * perceptionRadius;
    const separation2 = separationRadius * separationRadius;
    const fovCos = Math.cos((Math.min(fieldOfView, 360) * Math.PI) / 360);
    const fullView = fieldOfView >= 360;

    const px = this.x[i];
    const py = this.y[i];
    const pvx = this.vx[i];
    const pvy = this.vy[i];
    const pSpeed = Math.hypot(pvx, pvy) || 1;

    let sepX = 0;
    let sepY = 0;
    let aliX = 0;
    let aliY = 0;
    let cohX = 0;
    let cohY = 0;
    let neighbors = 0;
    let separated = 0;

    const col = this.colOf(px);
    const row = this.rowOf(py);

    for (let r = row - 1; r <= row + 1; r++) {
      if (r < 0 || r >= this.rows) continue;
      for (let c = col - 1; c <= col + 1; c++) {
        if (c < 0 || c >= this.cols) continue;
        const cell = r * this.cols + c;
        const end = this.cellStart[cell + 1];
        for (let k = this.cellStart[cell]; k < end; k++) {
          const j = this.cellItems[k];
          if (j === i) continue;

          const dx = this.x[j] - px;
          const dy = this.y[j] - py;
          const d2 = dx * dx + dy * dy;
          if (d2 > perception2 || d2 === 0) continue;

          if (!fullView) {
            // 身后的邻居看不见：与自身朝向的夹角超出视野角就跳过
            const dist = Math.sqrt(d2);
            if ((pvx * dx + pvy * dy) / (pSpeed * dist) < fovCos) continue;
          }

          neighbors++;
          aliX += this.vx[j];
          aliY += this.vy[j];
          cohX += this.x[j];
          cohY += this.y[j];

          if (d2 < separation2) {
            // 排斥力与距离成反比：越近推得越狠
            sepX -= dx / d2;
            sepY -= dy / d2;
            separated++;
          }
        }
      }
    }

    out.neighbors = neighbors;
    out.sepX = 0;
    out.sepY = 0;
    out.aliX = 0;
    out.aliY = 0;
    out.cohX = 0;
    out.cohY = 0;

    if (separated > 0) {
      const steer = steerToward(sepX, sepY, pvx, pvy, maxSpeed, maxForce);
      out.sepX = steer.x;
      out.sepY = steer.y;
    }

    if (neighbors > 0) {
      const ali = steerToward(
        aliX / neighbors,
        aliY / neighbors,
        pvx,
        pvy,
        maxSpeed,
        maxForce
      );
      out.aliX = ali.x;
      out.aliY = ali.y;

      const coh = steerToward(
        cohX / neighbors - px,
        cohY / neighbors - py,
        pvx,
        pvy,
        maxSpeed,
        maxForce
      );
      out.cohX = coh.x;
      out.cohY = coh.y;
    }

    return out;
  }

  /** 取出第 i 只鸟视野内的邻居下标，仅用于可视化，会分配数组 */
  neighborsOf(i: number, config: BoidsConfig): number[] {
    this.ensureGrid(config);
    const result: number[] = [];
    const perception2 = config.perceptionRadius * config.perceptionRadius;
    const fovCos = Math.cos(
      (Math.min(config.fieldOfView, 360) * Math.PI) / 360
    );
    const fullView = config.fieldOfView >= 360;
    const px = this.x[i];
    const py = this.y[i];
    const pvx = this.vx[i];
    const pvy = this.vy[i];
    const pSpeed = Math.hypot(pvx, pvy) || 1;

    const col = this.colOf(px);
    const row = this.rowOf(py);

    for (let r = row - 1; r <= row + 1; r++) {
      if (r < 0 || r >= this.rows) continue;
      for (let c = col - 1; c <= col + 1; c++) {
        if (c < 0 || c >= this.cols) continue;
        const cell = r * this.cols + c;
        const end = this.cellStart[cell + 1];
        for (let k = this.cellStart[cell]; k < end; k++) {
          const j = this.cellItems[k];
          if (j === i) continue;
          const dx = this.x[j] - px;
          const dy = this.y[j] - py;
          const d2 = dx * dx + dy * dy;
          if (d2 > perception2 || d2 === 0) continue;
          if (!fullView) {
            const dist = Math.sqrt(d2);
            if ((pvx * dx + pvy * dy) / (pSpeed * dist) < fovCos) continue;
          }
          result.push(j);
        }
      }
    }
    return result;
  }

  metrics(): FlockMetrics {
    if (this.count === 0) {
      return { polarization: 0, averageSpeed: 0, averageNeighbors: 0 };
    }
    let dirX = 0;
    let dirY = 0;
    let speedSum = 0;
    for (let i = 0; i < this.count; i++) {
      const speed = Math.hypot(this.vx[i], this.vy[i]);
      speedSum += speed;
      if (speed > 0) {
        dirX += this.vx[i] / speed;
        dirY += this.vy[i] / speed;
      }
    }
    return {
      polarization: Math.hypot(dirX, dirY) / this.count,
      averageSpeed: speedSum / this.count,
      averageNeighbors: this.neighborTotal / this.count,
    };
  }

  // ─── 均匀网格 ───────────────────────────────────────────────
  //
  // 注意：wrap 模式下网格不做环面处理，跨边界的邻居暂时"看不见"。
  // 这是可视化里常见的简化，对观感几乎没有影响，但换来了简单得多
  // 的实现。

  private colOf(x: number) {
    const col = Math.floor(x / this.cellSize);
    return col < 0 ? 0 : col >= this.cols ? this.cols - 1 : col;
  }

  private rowOf(y: number) {
    const row = Math.floor(y / this.cellSize);
    return row < 0 ? 0 : row >= this.rows ? this.rows - 1 : row;
  }

  /** 网格失效或格子尺寸需要变化时才重建，其余情况是一次廉价判断 */
  private ensureGrid(config: BoidsConfig) {
    const radius = Math.max(
      8,
      config.perceptionRadius,
      config.separationRadius
    );
    if (!this.gridDirty && this.cellSize === radius) return;
    this.buildGrid(radius);
    this.gridDirty = false;
  }

  private buildGrid(radius: number) {
    this.cellSize = Math.max(8, radius);
    this.cols = Math.max(1, Math.ceil(this.width / this.cellSize));
    this.rows = Math.max(1, Math.ceil(this.height / this.cellSize));

    const cellCount = this.cols * this.rows;
    if (this.cellStart.length !== cellCount + 1) {
      this.cellStart = new Int32Array(cellCount + 1);
      this.cursor = new Int32Array(cellCount);
    } else {
      this.cellStart.fill(0);
    }

    // 计数
    for (let i = 0; i < this.count; i++) {
      const cell = this.rowOf(this.y[i]) * this.cols + this.colOf(this.x[i]);
      this.cellOf[i] = cell;
      this.cellStart[cell + 1]++;
    }
    // 前缀和 → 每个格子在 cellItems 中的起始下标
    for (let c = 0; c < cellCount; c++) {
      this.cellStart[c + 1] += this.cellStart[c];
      this.cursor[c] = this.cellStart[c];
    }
    // 填充
    for (let i = 0; i < this.count; i++) {
      this.cellItems[this.cursor[this.cellOf[i]]++] = i;
    }
  }
}

/**
 * Reynolds 的转向公式：把"期望方向"放大到最大速度，减去当前速度，
 * 再把结果限幅到 maxForce。限幅是关键 —— 它让鸟只能平滑转弯，
 * 而不是瞬间掉头。
 */
const steerResult = { x: 0, y: 0 };

function steerToward(
  desiredX: number,
  desiredY: number,
  vx: number,
  vy: number,
  maxSpeed: number,
  maxForce: number
) {
  const length = Math.hypot(desiredX, desiredY);
  if (length < 1e-6) {
    steerResult.x = 0;
    steerResult.y = 0;
    return steerResult;
  }
  let sx = (desiredX / length) * maxSpeed - vx;
  let sy = (desiredY / length) * maxSpeed - vy;
  const force = Math.hypot(sx, sy);
  if (force > maxForce) {
    sx = (sx / force) * maxForce;
    sy = (sy / force) * maxForce;
  }
  steerResult.x = sx;
  steerResult.y = sy;
  return steerResult;
}
