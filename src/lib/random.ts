/**
 * 线性同余伪随机数。
 *
 * 演示里需要"同一个种子长出同一张图"：换算法对比时，四块画布必须
 * 拿到同一串随机数，比较才成立；用户想复现刚才那张迷宫时也一样。
 * `Math.random` 给不了这个。
 */
export function seededRandom(seed: number) {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 0x100000000;
  };
}
