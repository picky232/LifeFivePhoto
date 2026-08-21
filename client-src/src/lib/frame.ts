/**
 * 프레임 규격 — 이 파일이 유일한 기준점.
 *
 * 화면 미리보기(DOM)와 인쇄용 합성(canvas)이 **같은 숫자**를 쓴다.
 * 그래서 미리보기에서 보인 대로 종이에 나온다. 규격이 바뀌면 여기만 고친다.
 *
 * ⚠️ 미확정: 설계서에 인화 4×6인치와 전체 프레임 4×5인치가 같이 적혀 있다.
 *    CP1500 엽서 용지가 100×148mm(≒4×6)이므로 일단 4×6으로 잡았다.
 *    4×5로 확정되면 PAGE_INCH.h 만 5로 바꾸면 화면·합성이 함께 따라온다.
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

// 여백과 간격을 줄여 사진을 키웠다. 간격이 넓으면 사진 다섯 장이
// 한 벌로 안 보이고 각각 떨어진 네모로 읽힌다.
const MARGIN = 42; // 종이 테두리 여백
const GAP = 18; // 컷 사이 간격
const COLS = 2;
const ROWS = 3;

/** 컷 한 칸 크기 — 위 여백/간격에서 딱 나누어떨어지게 골랐다 (549×560) */
export const CUT = {
  w: (PAGE.w - MARGIN * 2 - GAP * (COLS - 1)) / COLS,
  h: (PAGE.h - MARGIN * 2 - GAP * (ROWS - 1)) / ROWS,
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
    x: MARGIN + col * (CUT.w + GAP),
    y: MARGIN + row * (CUT.h + GAP),
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
