import { FIRE, LAVA, OIL, SAND, STONE, WATER, WOOD } from './materials';
import type { SandWorld } from './sand';

/**
 * 预设场景。
 *
 * 四个场景各自逼出一条不同的规则：沙漏考粉末的堆积角，油水槽考密度分层，
 * 火山把三条反应串成一条链，空场地留给用户自己画。
 *
 * 都按画布比例摆放而不是写死坐标 —— 这一页的网格随窗口和格子边长变，
 * 写死的话在窄屏上会摆到画布外面去。
 */

export interface Scene {
  id: string;
  label: string;
  blurb: string;
  build: (world: SandWorld) => void;
}

function fillRect(
  world: SandWorld,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  id: number
) {
  for (let y = Math.max(0, y0); y <= Math.min(world.rows - 1, y1); y++) {
    for (let x = Math.max(0, x0); x <= Math.min(world.cols - 1, x1); x++) {
      world.set(x, y, id);
    }
  }
}

/** 底部地板 + 两侧墙，免得东西从画布边上漏光 */
function box(world: SandWorld) {
  const { cols, rows } = world;
  fillRect(world, 0, rows - 3, cols - 1, rows - 1, STONE);
  fillRect(world, 0, 0, 1, rows - 1, STONE);
  fillRect(world, cols - 2, 0, cols - 1, rows - 1, STONE);
}

const hourglass: Scene = {
  id: 'hourglass',
  label: '沙漏',
  blurb: '颈口会自己卡出拱形，底下堆出的锥角是规则的副产品，不是设定值。',
  build: world => {
    box(world);
    const { cols, rows } = world;
    const mid = cols >> 1;
    const neck = Math.floor(rows * 0.52);
    const gap = 3;
    const wall = 3;
    const sandTop = Math.max(3, neck - Math.floor(rows * 0.36));

    for (let y = 2; y <= neck; y++) {
      // 45 度斜壁：越往上开口越宽
      const half = gap + (neck - y);
      if (half >= mid - 2) continue;
      for (let d = 0; d < wall; d++) {
        world.set(mid - half - d, y, STONE);
        world.set(mid + half + d, y, STONE);
      }
      if (y >= sandTop) {
        fillRect(world, mid - half + 1, y, mid + half - 1, y, SAND);
      }
    }
  },
};

const layers: Scene = {
  id: 'layers',
  label: '油水分层',
  blurb:
    '油被故意放在水下面。没有一行代码写着「油浮在水上」—— 等几秒看它自己翻过来。',
  build: world => {
    box(world);
    const { cols, rows } = world;
    const left = 4;
    const right = cols - 5;
    const top = Math.floor(rows * 0.38);
    const bottom = rows - 4;
    const mid = Math.floor((top + bottom) / 2);

    // 槽壁
    fillRect(world, left, top, left + 2, bottom, STONE);
    fillRect(world, right - 2, top, right, bottom, STONE);

    // 故意反着装：重的在上，轻的在下
    fillRect(world, left + 3, mid + 1, right - 3, bottom, OIL);
    fillRect(world, left + 3, top + 1, right - 3, mid, WATER);

    // 槽上方架一根木条，一头点着火 —— 火沿着木头烧过来，最后掉进油里。
    //
    // 火必须垫在木条**底下**：它是气体，每帧都在往上飘。摆在木条上方
    // 那一撮火会径直飘走，木头一格都烧不着（这个场景一开始就是这么写错的）。
    // 垫在下面，火升到木条底面就被挡住，贴着烧到自己寿命耗尽为止。
    const beamY = Math.max(4, top - 10);
    fillRect(world, left + 6, beamY, right - 6, beamY + 2, WOOD);
    fillRect(world, left + 6, beamY + 3, left + 17, beamY + 6, FIRE);

    // 木条另一头垂一根柱子扎进槽里。火自己只会往上飘，永远走不下来 ——
    // 但「被点燃」只要求**挨着**火，不要求火挪过去，所以火能顺着木头
    // 一路往下蔓延，最后接上液面。等油浮上来，这根柱子就是引信。
    fillRect(world, right - 12, beamY + 3, right - 10, top + 4, WOOD);
  },
};

const volcano: Scene = {
  id: 'volcano',
  label: '火山',
  blurb: '岩浆滴到木头上点火，烧穿后掉进水里凝成石头，蒸汽升顶又凝成雨。',
  build: world => {
    box(world);
    const { cols, rows } = world;
    const mid = cols >> 1;

    // 顶上一个漏底的岩浆槽
    const potTop = 3;
    const potBottom = Math.floor(rows * 0.2);
    fillRect(world, mid - 12, potTop, mid - 10, potBottom, STONE);
    fillRect(world, mid + 10, potTop, mid + 12, potBottom, STONE);
    fillRect(world, mid - 10, potBottom, mid - 2, potBottom + 2, STONE);
    fillRect(world, mid + 2, potBottom, mid + 10, potBottom + 2, STONE);
    fillRect(world, mid - 9, potTop + 1, mid + 9, potBottom - 1, LAVA);

    // 中间一层木头平台，两端搭在墙上
    const deckY = Math.floor(rows * 0.5);
    fillRect(world, 2, deckY, cols - 3, deckY + 2, WOOD);

    // 底下一池水
    const poolTop = Math.floor(rows * 0.76);
    fillRect(world, 2, poolTop, cols - 3, rows - 4, WATER);
  },
};

const sandbox: Scene = {
  id: 'sandbox',
  label: '空场地',
  blurb: '只有地板和两堵墙。剩下的自己画 —— 每种材质都在右边的调色板上。',
  build: world => {
    box(world);
  },
};

export const scenes: Scene[] = [hourglass, layers, volcano, sandbox];

export function findScene(id: string) {
  return scenes.find(scene => scene.id === id);
}
