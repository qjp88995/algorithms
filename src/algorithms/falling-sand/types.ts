export type MaterialKind = 'empty' | 'static' | 'powder' | 'liquid' | 'gas';

export interface Material {
  id: number;
  /** 面板、图例、说明里用的名字 */
  name: string;
  kind: MaterialKind;
  /**
   * 密度。只在流体之间比较：往下走要比对方重，往上浮要比对方轻。
   * 静态固体和粉末不参与比较 —— 谁也钻不过去。
   */
  density: number;
  color: string;
  /** 亮度抖动幅度（0~1）。沙子的颗粒感全靠它，一块纯色是看不出在流动的 */
  jitter: number;
  /** 液体 / 气体每帧最多横向找几格空位 */
  dispersion: number;
  /** 每个着火的邻居，每帧点燃它的概率 */
  flammability: number;
  /** 被点燃后变成什么 */
  burnsTo: number;
  /** 寿命区间（帧），到点变成 decayTo */
  lifetime: [number, number] | null;
  decayTo: number;
  /** 寿命到点时变成 decayTo 的概率，否则直接消失 */
  decayChance: number;
  /** 有寿命的材质按剩余寿命渐变到这个颜色，于是火焰自己会由黄转红 */
  fadeColor: string | null;
  /** 气体每帧上浮的概率。小于 1 才看得出是「飘」而不是「弹」 */
  buoyancy: number;
  /**
   * 贴着燃料烧：四邻还有可燃物时就不上浮。
   *
   * 只有火需要。木头一着火就整格变成气体火焰，火苗当帧就升走了 ——
   * 燃料还在，点火的人却跑了，于是火只烧穿正上方那一条就断链。
   * 把火焰按在燃料上，「沿着木头蔓延」才成立。
   */
  clingsToFuel: boolean;
  /**
   * 永不休眠。
   *
   * 只给主动点火的东西（火、岩浆）：一潭被石头困住的岩浆一格都不动，
   * 所在块本该睡着 —— 可它还得每帧去点旁边的木头。剩下的材质都遵守
   * 「不动就睡」，否则一池水就把 chunk 优化整个废掉了。
   */
  restless: boolean;
  /** 材质面板上的一句话 */
  blurb: string;
}

/** 一条接触反应：a 挨到 b，各自变成 becomesA / becomesB */
export interface Reaction {
  a: number;
  b: number;
  becomesA: number;
  becomesB: number;
  chance: number;
}

export interface SandOptions {
  /** 关掉就是每帧全屏扫 —— 这一页的主角，用来对比省了多少 */
  useChunks: boolean;
  /** 每帧翻转水平扫描方向。关掉整堆沙子会朝一侧漂 */
  alternateScan: boolean;
  /** 自底向上扫。关掉就是自顶向下 —— 一粒沙一帧掉到底 */
  bottomUp: boolean;
}

export interface SandStats {
  frame: number;
  /** 非空像素数 */
  filled: number;
  /** 本帧真正处理过的 chunk 数 */
  activeChunks: number;
  totalChunks: number;
  /** 本帧扫过的像素数 —— 和 cols×rows 一比就知道 chunk 省了多少 */
  scanned: number;
  /** 本帧发生过移动的像素数 */
  moved: number;
}

export interface SandConfig {
  /** 一个格子画多少屏幕像素 */
  cellSize: number;
  /** 每帧推进几步模拟 */
  stepsPerFrame: number;
  brushSize: number;
  material: number;
  showChunks: boolean;
  useChunks: boolean;
  alternateScan: boolean;
  bottomUp: boolean;
}
