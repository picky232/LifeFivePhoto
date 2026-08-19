/**
 * 분당경영고 5개 학과 — 컷 5개와 1:1로 대응한다.
 * SLOTS[i] 의 컷에 DEPARTMENTS[i] 의 이름표가 박힌다.
 *
 * ── 색과 그림의 출처 ──────────────────────────────────────
 * 학교 공식 CI(분당경영고등학교CIP.ai)와 학과별 마스코트(분경고 마스코트.ai)에서
 * 뽑았다. 색은 심벌마크 픽셀에서 실측한 값이다.
 *
 *   초록 #0db04b  젊음과 가능성
 *   파랑 #1189ca  꿈과 희망
 *   남색 #2f368f  신뢰와 충실함
 *   주황 #f48020  열정과 에너지
 *
 * ⚠️ 남색 원본은 학과 색으로 못 쓴다. 어두운 화면에서 대비 1.82,
 *    인쇄 이름표에 검정 글자를 얹으면 1.93이라 읽히지 않는다.
 *    그래서 공식 남색은 심벌에만 두고, 회계금융과에는 그걸 밝힌 값을 쓴다.
 *
 * ⚠️ 마스코트 원본의 학과 이름이 지금 명단과 다르다 —
 *    원본은 "회계과 · IT과", 명단은 "회계금융과 · 인공지능개발과".
 *    회계금융과는 아직 학교 확인이 필요하다.
 *
 * ⚠️ tagline 은 화면 채우기용 임시 문구다. 학교에서 쓰는 표현으로 바꿔야 한다.
 */

export type Department = {
  id: string;
  /** 프레임에 인쇄되는 정식 명칭 */
  name: string;
  /** 좁은 곳에 넣을 짧은 이름 */
  short: string;
  /** 학과 강조색 */
  accent: string;
  /** 그 색에 CI가 부여한 뜻 */
  accentMeaning: string;
  /** 임시 소개 문구 — 학교 확정 문구로 교체 필요 */
  tagline: string;
  /** 학과 마스코트 (public/brand) */
  mascot: string;
};

export const DEPARTMENTS: Department[] = [
  {
    id: "accounting",
    name: "회계금융과",
    short: "회계금융",
    accent: "#787cb6", // 공식 남색 #2f368f 를 밝힌 값 (원본은 대비 미달)
    accentMeaning: "신뢰와 충실함",
    tagline: "숫자로 읽는 경영",
    mascot: "/brand/dept-accounting.png",
  },
  {
    id: "hotel",
    name: "호텔경영과",
    short: "호텔경영",
    accent: "#f48020",
    accentMeaning: "열정과 에너지",
    tagline: "사람을 맞이하는 일",
    mascot: "/brand/dept-hotel.png",
  },
  {
    id: "smart",
    name: "스마트경영과",
    short: "스마트경영",
    accent: "#1189ca",
    accentMeaning: "꿈과 희망",
    tagline: "데이터로 움직이는 조직",
    mascot: "/brand/dept-smart.png",
  },
  {
    id: "ai",
    name: "인공지능개발과",
    short: "인공지능개발",
    accent: "#0db04b",
    accentMeaning: "젊음과 가능성",
    tagline: "배우는 기계를 만든다",
    mascot: "/brand/dept-it.png",
  },
  {
    id: "design",
    name: "그래픽디자인과",
    short: "그래픽디자인",
    accent: "#81d8d0",
    accentMeaning: "부스 강조색",
    tagline: "보이는 것을 설계한다",
    mascot: "/brand/dept-design.png",
  },
];

export const SCHOOL_NAME = "분당경영고등학교";
export const SCHOOL_SHORT = "분당경영고";

/** 학교 심벌마크 — 성장하는 지식의 탑 */
export const SCHOOL_SYMBOL = "/brand/symbol.png";

/** 스플래시에 올라가는 만든 사람. 적힌 순서대로 나온다. */
export const MADE_BY = ["신지호", "윤지원"];
