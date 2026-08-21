'use strict';

/**
 * 프레임 규격 한 곳. 가이드·예시·빈 틀이 모두 이 값을 읽는다.
 *
 * 좌우와 위아래를 따로 둔다. 판이 2:3 이고 칸도 2열 3행이라
 * 여백과 간격을 똑같이 주면 칸이 반드시 세로로 길어진다.
 * 가로를 더 길게 하려면 좌우 쪽을 따로 좁혀야 한다.
 */

const G = {
  W: 1200, H: 1800,
  MX: 80,   // 좌우 여백
  MY: 135,  // 위아래 여백
  GX: 80,   // 칸 사이 가로 간격
  GY: 90,   // 칸 사이 세로 간격
  CW: 480, CH: 450,
};

G.slots = [0, 1, 2, 3, 4].map((i) => {
  const col = i < 3 ? 0 : 1;
  const row = i < 3 ? i : i - 3;
  return {
    n: i + 1,
    x: G.MX + col * (G.CW + G.GX),
    y: G.MY + row * (G.CH + G.GY),
    w: G.CW, h: G.CH,
  };
});

G.brand = {
  x: G.MX + (G.CW + G.GX),
  y: G.MY + 2 * (G.CH + G.GY),
  w: G.CW, h: G.CH,
};

/** 가운데 세로 통로 */
G.channel = { x: G.MX + G.CW, w: G.GX };

module.exports = G;
