import type { BoidsConfig, BoidsPreset } from './types';

export const defaultConfig: BoidsConfig = {
  count: 320,
  perceptionRadius: 62,
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
 * 预设用来快速展示"同一套规则、不同权重"能产生的不同集体形态，
 * 这是群鸟算法最直观的教学点。
 */
export const presets: BoidsPreset[] = [
  {
    id: 'default',
    label: '经典鸟群',
    description: '三条规则大致均衡，形成松散又有方向感的群体。',
    patch: {
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
      separationWeight: 2.2,
      alignmentWeight: 0,
      cohesionWeight: 0,
      perceptionRadius: 50,
      separationRadius: 40,
      maxSpeed: 140,
    },
  },
];

// ─── 模拟 ─────────────────────────────────────────────────────
/** 靠近边界时开始向内转向的余量（px），仅 bounce 模式使用 */
export const EDGE_MARGIN = 64;
/** 个体数量上限，Flock 会按它预分配 Float32Array */
export const FLOCK_CAPACITY = 4000;

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
