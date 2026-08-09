import type { Material, Reaction } from './types';

/**
 * 材质表。
 *
 * 整个模拟没有「流体方程」这种东西 —— 一格像素的全部身份就是这张表里的
 * 一行：它属于哪一类（不动 / 粉末 / 液体 / 气体）、有多重、烧不烧得着。
 * 运动规则只有四条，按 kind 分派；水会分层、油会浮、火会蔓延，
 * 全是这几个数字撞出来的，没有一行代码专门写「油浮在水上」。
 *
 * id 直接就是数组下标，这样内核里能拿 Uint8Array 存材质、拿下标查表，
 * 不必在每帧几万次的热路径上碰字符串。
 */

export const EMPTY = 0;
export const STONE = 1;
export const WOOD = 2;
export const SAND = 3;
export const COAL = 4;
export const WATER = 5;
export const OIL = 6;
export const LAVA = 7;
export const FIRE = 8;
export const SMOKE = 9;
export const STEAM = 10;

export const MATERIALS: Material[] = [
  {
    id: EMPTY,
    name: '空',
    kind: 'empty',
    density: 0,
    color: '#0d1017',
    jitter: 0,
    dispersion: 0,
    flammability: 0,
    burnsTo: EMPTY,
    lifetime: null,
    decayTo: EMPTY,
    decayChance: 0,
    fadeColor: null,
    buoyancy: 0,
    clingsToFuel: false,
    restless: false,
    blurb: '当橡皮用：涂上去就是把那一片擦干净。',
  },
  {
    id: STONE,
    name: '石头',
    kind: 'static',
    density: 100,
    color: '#6b7484',
    jitter: 0.18,
    dispersion: 0,
    flammability: 0,
    burnsTo: EMPTY,
    lifetime: null,
    decayTo: EMPTY,
    decayChance: 0,
    fadeColor: null,
    buoyancy: 0,
    clingsToFuel: false,
    restless: false,
    blurb: '不动、不烧、谁也钻不过去。拿来搭容器和斜坡。',
  },
  {
    id: WOOD,
    name: '木头',
    kind: 'static',
    density: 100,
    color: '#8a5a34',
    jitter: 0.22,
    dispersion: 0,
    flammability: 0.05,
    burnsTo: FIRE,
    lifetime: null,
    decayTo: EMPTY,
    decayChance: 0,
    fadeColor: null,
    buoyancy: 0,
    clingsToFuel: false,
    restless: false,
    blurb: '和石头一样不动，只多了一条：挨着火会自己变成火。',
  },
  {
    id: SAND,
    name: '沙',
    kind: 'powder',
    density: 6,
    color: '#dcb063',
    jitter: 0.3,
    dispersion: 0,
    flammability: 0,
    burnsTo: EMPTY,
    lifetime: null,
    decayTo: EMPTY,
    decayChance: 0,
    fadeColor: null,
    buoyancy: 0,
    clingsToFuel: false,
    restless: false,
    blurb: '先看正下方，不行再看左下右下。三句话堆出一个沙堆。',
  },
  {
    id: COAL,
    name: '煤',
    kind: 'powder',
    density: 5,
    color: '#3f4552',
    jitter: 0.35,
    dispersion: 0,
    flammability: 0.03,
    burnsTo: FIRE,
    lifetime: null,
    decayTo: EMPTY,
    decayChance: 0,
    fadeColor: null,
    buoyancy: 0,
    clingsToFuel: false,
    restless: false,
    blurb: '和沙同一套运动规则，只改了两个数：稍轻一点，而且能烧。',
  },
  {
    id: WATER,
    name: '水',
    kind: 'liquid',
    density: 2,
    color: '#3d7fc4',
    jitter: 0.16,
    dispersion: 5,
    flammability: 0,
    burnsTo: EMPTY,
    lifetime: null,
    decayTo: EMPTY,
    decayChance: 0,
    fadeColor: null,
    buoyancy: 0,
    clingsToFuel: false,
    restless: false,
    blurb: '下不去就往两边找，一帧最多铺开五格。能灭火，浇岩浆出石头。',
  },
  {
    id: OIL,
    name: '油',
    kind: 'liquid',
    density: 1.2,
    color: '#7d6a30',
    jitter: 0.2,
    dispersion: 3,
    flammability: 0.09,
    burnsTo: FIRE,
    lifetime: null,
    decayTo: EMPTY,
    decayChance: 0,
    fadeColor: null,
    buoyancy: 0,
    clingsToFuel: false,
    restless: false,
    blurb: '比水轻，所以永远被水挤到上面 —— 而且一点就着。',
  },
  {
    id: LAVA,
    name: '岩浆',
    kind: 'liquid',
    density: 3,
    color: '#e2542a',
    jitter: 0.28,
    dispersion: 1,
    flammability: 0,
    burnsTo: EMPTY,
    lifetime: null,
    decayTo: EMPTY,
    decayChance: 0,
    fadeColor: null,
    buoyancy: 0,
    clingsToFuel: false,
    restless: true,
    blurb: '一帧只挪一格的黏液体。点着一切可燃物，碰到水就凝成石头。',
  },
  {
    id: FIRE,
    name: '火',
    kind: 'gas',
    density: 0.2,
    color: '#ffd76b',
    jitter: 0.12,
    dispersion: 1,
    flammability: 0,
    burnsTo: EMPTY,
    lifetime: [10, 34],
    decayTo: SMOKE,
    decayChance: 0.3,
    fadeColor: '#c4331a',
    buoyancy: 0.85,
    clingsToFuel: true,
    restless: true,
    blurb: '有寿命的气体：一边往上飘一边点燃邻居，烧完留下三成烟。',
  },
  {
    id: SMOKE,
    name: '烟',
    kind: 'gas',
    density: 0.35,
    color: '#59606f',
    jitter: 0.18,
    dispersion: 3,
    flammability: 0,
    burnsTo: EMPTY,
    lifetime: [70, 170],
    decayTo: EMPTY,
    decayChance: 1,
    fadeColor: '#20242e',
    buoyancy: 0.5,
    clingsToFuel: false,
    restless: false,
    blurb: '比火重、比空气轻，慢慢散开然后淡掉。',
  },
  {
    id: STEAM,
    name: '蒸汽',
    kind: 'gas',
    density: 0.5,
    color: '#b9c8d8',
    jitter: 0.14,
    dispersion: 4,
    flammability: 0,
    burnsTo: EMPTY,
    lifetime: [110, 240],
    decayTo: WATER,
    decayChance: 1,
    fadeColor: '#5d6f83',
    buoyancy: 0.7,
    clingsToFuel: false,
    restless: false,
    blurb: '升到顶上待够时间就凝回水，于是这套系统里真的会下雨。',
  },
];

export const MATERIAL_COUNT = MATERIALS.length;

/** 面板上可选的画笔，按「先固体后流体」排 */
export const PALETTE = [
  EMPTY,
  STONE,
  WOOD,
  SAND,
  COAL,
  WATER,
  OIL,
  LAVA,
  FIRE,
  SMOKE,
  STEAM,
];

// ─── 派生成定长数组：热路径上只查下标，不碰对象 ────────────────

export const KIND_EMPTY = 0;
export const KIND_STATIC = 1;
export const KIND_POWDER = 2;
export const KIND_LIQUID = 3;
export const KIND_GAS = 4;

const KIND_CODE: Record<Material['kind'], number> = {
  empty: KIND_EMPTY,
  static: KIND_STATIC,
  powder: KIND_POWDER,
  liquid: KIND_LIQUID,
  gas: KIND_GAS,
};

export const KIND = Uint8Array.from(MATERIALS, m => KIND_CODE[m.kind]);
export const DENSITY = Float32Array.from(MATERIALS, m => m.density);
export const DISPERSION = Uint8Array.from(MATERIALS, m => m.dispersion);
export const BUOYANCY = Float32Array.from(MATERIALS, m => m.buoyancy);
export const LIFE_MIN = Uint8Array.from(MATERIALS, m => m.lifetime?.[0] ?? 0);
export const LIFE_MAX = Uint8Array.from(MATERIALS, m => m.lifetime?.[1] ?? 0);
export const DECAY_TO = Uint8Array.from(MATERIALS, m => m.decayTo);
export const DECAY_CHANCE = Float32Array.from(MATERIALS, m => m.decayChance);
export const RESTLESS = Uint8Array.from(MATERIALS, m => (m.restless ? 1 : 0));
export const CLINGS = Uint8Array.from(MATERIALS, m => (m.clingsToFuel ? 1 : 0));
/** 能不能烧。火拿它判断四邻还有没有燃料 */
export const FLAMMABLE = Uint8Array.from(MATERIALS, m =>
  m.flammability > 0 ? 1 : 0
);

/**
 * 接触反应表。
 *
 * 显式写出来的只有两条 —— 水灭火、水淬岩浆。「木头烧起来」「油被点着」
 * 不在这里，它们是从材质自己的 `flammability` 派生的：凡是能烧的东西，
 * 自动获得「碰到火」和「碰到岩浆」两条规则。这样加一种可燃材质只要填一个
 * 数，不用记得回来补表。
 */
export const reactions: Reaction[] = [
  { a: WATER, b: FIRE, becomesA: STEAM, becomesB: EMPTY, chance: 0.95 },
  { a: WATER, b: LAVA, becomesA: STEAM, becomesB: STONE, chance: 0.35 },
  ...MATERIALS.filter(m => m.flammability > 0).flatMap(m =>
    [FIRE, LAVA].map(source => ({
      a: m.id,
      b: source,
      becomesA: m.burnsTo,
      becomesB: source,
      chance: m.flammability,
    }))
  ),
];

/**
 * 反应查表：`[a][b] → (becomesA, becomesB, chance)`。
 *
 * 材质总共十来种，一张 N×N 的表才百来项，直接摊平成定长数组，
 * 内核里一次下标就能问出「这两格挨在一起会发生什么」。
 * 表是对称登记的（同时写入 a→b 和 b→a），扫描时只查一次方向就够。
 */
const PAIR = MATERIAL_COUNT * MATERIAL_COUNT;
export const REACT_SELF = new Int16Array(PAIR).fill(-1);
export const REACT_OTHER = new Int16Array(PAIR).fill(-1);
export const REACT_CHANCE = new Float32Array(PAIR);
/** 这个材质在表里有没有条目 —— 没有就整个跳过邻居检查 */
export const REACTIVE = new Uint8Array(MATERIAL_COUNT);

for (const r of reactions) {
  REACT_SELF[r.a * MATERIAL_COUNT + r.b] = r.becomesA;
  REACT_OTHER[r.a * MATERIAL_COUNT + r.b] = r.becomesB;
  REACT_CHANCE[r.a * MATERIAL_COUNT + r.b] = r.chance;
  REACT_SELF[r.b * MATERIAL_COUNT + r.a] = r.becomesB;
  REACT_OTHER[r.b * MATERIAL_COUNT + r.a] = r.becomesA;
  REACT_CHANCE[r.b * MATERIAL_COUNT + r.a] = r.chance;
  REACTIVE[r.a] = 1;
  REACTIVE[r.b] = 1;
}

export function materialOf(id: number): Material {
  return MATERIALS[id];
}
