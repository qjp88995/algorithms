import type { BoidsConfig, BoidsPreset } from './types';

export const defaultConfig: BoidsConfig = {
  count: 320,
  perception: 'metric',
  perceptionRadius: 62,
  neighborCount: 7,
  separationRadius: 22,
  fieldOfView: 300,
  separationWeight: 1.6,
  alignmentWeight: 1.0,
  cohesionWeight: 0.9,
  maxSpeed: 160,
  minSpeed: 60,
  maxForce: 320,
  edgeMode: 'wrap',
  pointer: {
    active: false,
    x: 0,
    y: 0,
    mode: 'repel',
    radius: 120,
    strength: 1.4,
  },
};

/**
 * 物种预设：同一套规则，按真实生物的感知方式和运动约束配参数。
 *
 * 鸟和鱼在算法上没有区别 —— Reynolds 原论文就说这个模型同时适用于
 * flock、herd 和 school。区别全在参数里：鸟靠视觉、后方有盲区、
 * 必须保持最低速度否则失速；鱼有侧线，近场全向感知、可以悬停，
 * 分离判断也更精确。
 */
export const speciesPresets: BoidsPreset[] = [
  {
    id: 'starling',
    label: '椋鸟群',
    description:
      '拓扑感知：固定跟最近的 7 个同伴互动。视觉有后方盲区，必须保持速度否则失速。把群拉散也不会解体。',
    patch: {
      perception: 'topological',
      neighborCount: 7,
      fieldOfView: 300,
      separationRadius: 24,
      separationWeight: 1.5,
      alignmentWeight: 1.6,
      cohesionWeight: 1.0,
      maxSpeed: 190,
      minSpeed: 90,
      maxForce: 300,
    },
  },
  {
    id: 'sardine',
    label: '沙丁鱼群',
    description:
      '度量感知，视野 360°（侧线无盲区）。近场排斥强、贴得更紧，水阻大所以可以慢到近乎悬停。',
    patch: {
      perception: 'metric',
      perceptionRadius: 46,
      fieldOfView: 360,
      separationRadius: 20,
      separationWeight: 2.2,
      alignmentWeight: 1.2,
      cohesionWeight: 1.3,
      maxSpeed: 130,
      minSpeed: 15,
      maxForce: 420,
    },
  },
];

/** 形态预设：展示"同一套规则、不同权重"能产生的不同集体形态 */
export const shapePresets: BoidsPreset[] = [
  {
    id: 'default',
    label: '经典鸟群',
    description: '三条规则大致均衡，形成松散又有方向感的群体。',
    patch: {
      perception: 'metric',
      separationWeight: 1.6,
      alignmentWeight: 1.0,
      cohesionWeight: 0.9,
      perceptionRadius: 62,
      separationRadius: 22,
      maxSpeed: 160,
    },
  },
  {
    id: 'swarm',
    label: '密集蜂群',
    description: '聚合强、对齐弱：抱成一团不停打转，方向不统一。',
    patch: {
      perception: 'metric',
      separationWeight: 1.1,
      alignmentWeight: 0.2,
      cohesionWeight: 2.4,
      perceptionRadius: 90,
      separationRadius: 16,
      maxSpeed: 130,
    },
  },
  {
    id: 'stream',
    label: '长距迁徙',
    description: '对齐强、视野大：整群朝同一方向拉成流线。',
    patch: {
      perception: 'metric',
      separationWeight: 1.2,
      alignmentWeight: 2.6,
      cohesionWeight: 0.6,
      perceptionRadius: 100,
      separationRadius: 24,
      maxSpeed: 210,
    },
  },
  {
    id: 'gas',
    label: '一盘散沙',
    description: '只剩分离：个体互相排斥，均匀铺开，没有群体可言。',
    patch: {
      perception: 'metric',
      separationWeight: 2.2,
      alignmentWeight: 0,
      cohesionWeight: 0,
      perceptionRadius: 50,
      separationRadius: 40,
      maxSpeed: 140,
    },
  },
];

export const presets: BoidsPreset[] = [...speciesPresets, ...shapePresets];

// ─── 模拟 ─────────────────────────────────────────────────────
/** 靠近边界时开始向内转向的余量（px），仅 bounce 模式使用 */
export const EDGE_MARGIN = 64;
/** 个体数量上限，Flock 会按它预分配 Float32Array */
export const FLOCK_CAPACITY = 4000;
/** 单次邻居收集的上限，超出就截断（度量模式下视野调到最大时的兜底） */
export const MAX_NEIGHBORS = 512;
/** 拓扑模式下 k 的上限 */
export const MAX_NEIGHBOR_COUNT = 16;
/**
 * 拓扑模式最多向外扩几圈格子去凑够 k 个邻居。
 *
 * 要撑得起"不管多远"这句话，上限必须够大到能覆盖整块画布 ——
 * 配合下面的格子下限，16 圈约 1500px。密集时凑够 k 个就提前退出，
 * 只有群体极度稀疏时才会真的扫这么远。
 */
export const MAX_SEARCH_RINGS = 16;
/** 拓扑模式的格子边长下限（px），太小会导致要扩很多圈才够得着邻居 */
export const TOPOLOGICAL_CELL_SIZE = 48;

/** 捕食者半径内聚合权重最多放大到几倍 —— 饵球和喷泉效应的来源 */
export const PREDATOR_COHESION_BOOST = 2.5;
/** 捕食者的排斥力相对普通驱散再放大几倍（近距离爆散） */
export const PREDATOR_PANIC_GAIN = 2.2;

// ─── 演示循环 ─────────────────────────────────────────────────
/** 一帧最多推进 50ms，避免切回后台标签页时 dt 过大把模拟崩掉 */
export const MAX_FRAME_SECONDS = 0.05;
/** 指标刷新间隔（秒），太快会让数字抖得看不清 */
export const STATS_INTERVAL = 0.25;
/** 点击画布时的拾取半径（px） */
export const PICK_RADIUS = 24;

// ─── 绘制 ─────────────────────────────────────────────────────
export const canvasColors = {
  /** 与 --color-canvas 保持一致 */
  background: '#181c24',
  /** 拖尾模式下每帧盖上去的半透明底色 */
  trail: 'rgba(24, 28, 36, 0.22)',
  boid: '#93a4c4',
  focus: '#ffffff',
  perception: 'rgba(120, 190, 255, 0.07)',
  separationRing: 'rgba(249, 115, 98, 0.35)',
  neighborLink: 'rgba(150, 190, 240, 0.28)',
  attractRing: 'rgba(90, 209, 200, 0.5)',
  repelRing: 'rgba(249, 115, 98, 0.5)',
  predatorRing: 'rgba(249, 115, 98, 0.85)',
  predatorCore: 'rgba(249, 115, 98, 0.25)',
} as const;

/** 三条规则各自的颜色，力向量箭头和图例共用 */
export const forceColors = {
  separation: '#f97362',
  alignment: '#5ad1c8',
  cohesion: '#f0c05a',
} as const;

export const boidShape = {
  length: 9,
  width: 3.6,
} as const;
