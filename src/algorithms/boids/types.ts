/**
 * 鼠标在画布上的作用力。
 *
 * `predator` 不只是更强的排斥：近距离触发爆散（flash expansion），
 * 同时临时抬高聚合权重，于是被冲散的个体会绕到捕食者身后重新合拢
 * （喷泉效应），或在被逼近时抱成一团（饵球）。这些形态都不是硬编码的，
 * 是排斥与聚合此消彼长后涌现出来的。
 */
export interface PointerState {
  active: boolean;
  x: number;
  y: number;
  mode: 'attract' | 'repel' | 'predator';
  radius: number;
  strength: number;
}

/**
 * 邻居是怎么选出来的 —— Boids 里最容易被忽略、但影响最大的一个选择。
 *
 * metric（度量）：视野半径内的所有同伴。群体被拉稀疏时邻居数骤减，
 *   容易失联解体。
 * topological（拓扑）：固定跟最近的 k 个同伴互动，不管它们多远。
 *   Ballerini 等人 2008 年对椋鸟群做三维重建，发现真实的鸟用的是这一种
 *   （k ≈ 6–7），这让群体在被猎隼冲散、密度剧变时依然不散架。
 */
export type PerceptionMode = 'metric' | 'topological';

export type EdgeMode = 'wrap' | 'bounce';

export interface BoidsConfig {
  /** 个体数量 */
  count: number;
  perception: PerceptionMode;
  /** 视野半径：只有这个距离内的邻居才被感知（px），仅 metric 模式使用 */
  perceptionRadius: number;
  /** 拓扑模式下固定互动的邻居个数 k */
  neighborCount: number;
  /** 分离半径：小于它就开始互相推开（px），通常远小于视野半径 */
  separationRadius: number;
  /** 视野角度（度）：360 表示全向，小于 360 时看不到身后 */
  fieldOfView: number;
  separationWeight: number;
  alignmentWeight: number;
  cohesionWeight: number;
  /** 速度上下限（px/s）。有下限鸟群才不会停下来 */
  maxSpeed: number;
  minSpeed: number;
  /** 单条规则能施加的最大转向力（px/s²），决定转弯的灵活度 */
  maxForce: number;
  edgeMode: EdgeMode;
  pointer: PointerState;
}

export interface BoidsPreset {
  id: string;
  label: string;
  description: string;
  patch: Partial<Omit<BoidsConfig, 'pointer'>>;
}

/** 鼠标干预模式，比 PointerState 多一个"关闭" */
export type PointerInteraction = 'off' | 'attract' | 'repel' | 'predator';

/** 单只鸟的三个转向力（未乘权重），用于可视化展示 */
export interface Steering {
  sepX: number;
  sepY: number;
  aliX: number;
  aliY: number;
  cohX: number;
  cohY: number;
  neighbors: number;
}

export interface FlockMetrics {
  /** 极化度：所有速度方向单位向量的平均长度，1 = 完全同向，0 = 杂乱无章 */
  polarization: number;
  /** 平均速率（px/s） */
  averageSpeed: number;
  /** 每只鸟视野内的平均邻居数 */
  averageNeighbors: number;
}

/** 面板上展示的实时指标 = 群体指标 + 渲染帧率 */
export interface DemoStats extends FlockMetrics {
  fps: number;
}

export interface RenderOptions {
  /** 拖尾：不清屏，而是盖一层半透明底色，让轨迹缓慢淡出 */
  trails: boolean;
  /** 按航向给个体上色，同向的鸟颜色一致，群体结构一眼可见 */
  colorByHeading: boolean;
  /** 聚焦某只鸟：画出它的视野、邻居连线和三个转向力 */
  focusIndex: number | null;
}
