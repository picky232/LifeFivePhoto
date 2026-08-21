/**
 * 프레임 규격 — 이 파일이 유일한 기준점.
 *
 * 화면 미리보기(DOM)와 인쇄용 합성(canvas)이 **같은 숫자**를 쓴다.
 * 그래서 미리보기에서 보인 대로 종이에 나온다. 규격이 바뀌면 여기만 고친다.
 *
 * ── 종이와 캔버스가 다르다 ────────────────────────────────
 * 인화 용지는 100×148mm, 캔버스는 4×6인치(101.6×152.4mm)다. 용지가 더 작아
 * 가장자리가 잘리고, 인화기 여백이 더 붙는다. 세로가 더 많이 잘린다
 * (4.4mm 대 1.6mm).
 *
 * 캔버스를 용지에 맞추지 않는 이유는 촬영이 이 비율로 사진을 잘라 두기
 * 때문이다. 캔버스만 바꾸면 화면에서 본 구도와 종이에 나온 구도가 어긋난다.
 *
 * 대신 위아래 7mm · 좌우 4mm 를 흰 테로 비우고, 칸을 그 안쪽에만 둔다.
 * 이 값은 docs/frame-spec/geom.js 와 같아야 한다 — 그쪽은 외주에 넘길
 * 규격서를 그리고, 이쪽은 실제로 사진을 채운다. 둘이 갈라지면 종이에
 * 나온 자리와 그림의 구멍이 어긋난다. scripts/check-frame.js 로 잰다.
 */

/** 인쇄 해상도. 300dpi면 4×6이 1200×1800px. */
export const PRINT_DPI = 300;

/** 종이 크기(인치) */
export const PAGE_INCH = { w: 4, h: 6 } as const;

/** 종이 크기(픽셀) */
export const PAGE = {
  w: PAGE_INCH.w * PRINT_DPI,
  h: PAGE_INCH.h * PRINT_DPI,
} as const;

/** 종이 가로세로비. 화면에서 미리보기 박스를 만들 때 쓴다. */
export const PAGE_RATIO = PAGE.w / PAGE.h;

/** 잘려나가는 자리 — 흰색으로 비운다. 세로가 더 많이 잘려 위아래를 넓게 잡았다 */
const SAFE_X = 47; // 4mm
const SAFE_Y = 83; // 7mm

const MARGIN_X = 58; // 흰 테 안쪽 좌우 여백
const MARGIN_Y = 72; // 흰 테 안쪽 위아래 여백
const GAP_X = 90; // 컷 사이 가로 간격
const GAP_Y = 100; // 컷 사이 세로 간격

/** 컷 한 칸 크기 — 위 값들에서 딱 나누어떨어지게 골랐다 (450×430) */
export const CUT = {
  w: (PAGE.w - SAFE_X * 2 - MARGIN_X * 2 - GAP_X) / 2,
  h: (PAGE.h - SAFE_Y * 2 - MARGIN_Y * 2 - GAP_Y * 2) / 3,
} as const;

/** 컷 가로세로비. 카메라 미리보기와 썸네일을 이 비율로 잘라야 어긋나지 않는다. */
export const CUT_RATIO = CUT.w / CUT.h;

export type Slot = {
  /** 몇 번째 컷인지 (0-4) */
  index: number;
  x: number;
  y: number;
  w: number;
  h: number;
};

/**
 * 좌 3 · 우 2 배치 (설계서 그대로).
 *
 *   ┌─────┬─────┐
 *   │  1  │  4  │
 *   ├─────┼─────┤
 *   │  2  │  5  │
 *   ├─────┼─────┤
 *   │  3  │ 로고 │   ← 2열 3행은 학교 브랜딩 칸
 *   └─────┴─────┘
 */
function cell(col: number, row: number) {
  return {
    x: SAFE_X + MARGIN_X + col * (CUT.w + GAP_X),
    y: SAFE_Y + MARGIN_Y + row * (CUT.h + GAP_Y),
    w: CUT.w,
    h: CUT.h,
  };
}

export const SLOTS: Slot[] = [0, 1, 2, 3, 4].map((index) => {
  const col = index < 3 ? 0 : 1;
  const row = index < 3 ? index : index - 3;
  return { index, ...cell(col, row) };
});

/** 남는 한 칸 — 학교 이름이 들어간다 */
export const BRAND_CELL = cell(1, 2);

/** 총 몇 장 찍고 몇 장 고르는지 */
export const SHOT_COUNT = 8;
export const PICK_COUNT = SLOTS.length; // 5

/**
 * 자동 촬영 간격(초).
 *
 * 처음에는 10초였는데 8장을 찍는 동안 80초가 걸려, 뒤로 갈수록 자세가 풀리고
 * 줄이 밀렸다. 5초면 포즈를 바꿀 만큼은 되면서 한 바퀴가 절반으로 준다.
 *
 * 안내 화면과 촬영 화면의 문구·막대는 이 값을 읽어 쓴다. 여기만 고치면 된다.
 */
export const SHOOT_INTERVAL = 5;

/**
 * 인쇄 요청 뒤 완료 화면으로 넘어가기까지 기다리는 시간(초).
 *
 * 인쇄는 노트북에서 사람이 직접 뽑는다. 그래서 앱이 "몇 초 뒤에 나온다"를
 * 알 수 없다 — 예전에 55초를 세던 카운트다운은 지킬 수 없는 약속이었다.
 * 지금은 전송이 끝났다는 걸 잠깐 보여주고 넘어가기만 한다.
 */
export const REQUEST_DONE_SECONDS = 6;

/** 아무 조작 없을 때 처음 화면으로 되돌아가는 시간(초) */
export const IDLE_RESET_SECONDS = 120;
