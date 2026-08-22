/**
 * 고를 수 있는 프레임.
 *
 * 프레임은 사진이 빠진 뼈대다. 사진 자리는 투명하게 뚫려 있고,
 * 테두리·장식·학과 이름표·로고는 모두 이 그림 안에 들어 있다.
 * 합성할 때 사진을 먼저 깔고 그 위에 이 그림을 덮는다.
 *
 * ── 칸 자리는 프레임마다 다르지 않다 ────────────────────────
 * 다섯 칸의 위치와 크기는 frame.ts 의 SLOTS 하나로 고정한다.
 * 프레임은 그림만 다르다.
 *
 * 칸 비율이 프레임마다 다르면 촬영 단계가 꼬인다. 사진은 찍는 순간
 * 컷 비율로 잘라 저장하는데, 프레임은 그 뒤에 고르기 때문이다.
 * 정사각형으로 잘라 둔 사진을 가로로 긴 칸에 넣으면 위아래가 더 잘려
 * 머리가 날아간다. 자리를 고정해두면 이 문제가 아예 생기지 않는다.
 *
 * 새 프레임을 추가하려면 public/frames 에 PNG 를 넣고 여기 한 줄 더 적는다.
 */

export type Frame = {
  id: string;
  /** 고르는 화면에 보이는 이름 */
  name: string;
  /** 어떤 느낌인지 한 줄 */
  note: string;
  /** public 기준 경로. 1200x1800, 사진 자리는 투명 */
  image: string;
};

export const FRAMES: Frame[] = [
  {
    id: "mint",
    name: "민트",
    note: "마스코트가 크게 나오는 기본",
    image: "/frames/mint.png",
  },
  {
    id: "neon",
    name: "네온",
    note: "빛나는 바탕에 학과 이름표",
    image: "/frames/neon.png",
  },
  {
    id: "dark",
    name: "검정",
    note: "사진이 도드라지는 어두운 바탕",
    image: "/frames/dark.png",
  },
];

export const DEFAULT_FRAME = FRAMES[0];

export function findFrame(id: string | null): Frame {
  if (!id) return DEFAULT_FRAME;
  return FRAMES.find((f) => f.id === id) ?? DEFAULT_FRAME;
}
