import { BRAND_CELL, PAGE, SLOTS } from "./frame";
import { DEPARTMENTS, SCHOOL_NAME, SCHOOL_SYMBOL } from "./departments";

/**
 * 브라우저에서만 도는 코드다 (canvas·Image 사용).
 * 클라이언트 컴포넌트에서만 import 할 것.
 *
 * ── 인쇄물 규칙 ────────────────────────────────────────────
 * 화면과 같은 언어를 쓴다. 각진 모서리, 납작한 면, 색 세 개.
 * 둥근 모서리·그러데이션·발광은 넣지 않는다 — 화면은 각졌는데
 * 종이만 둥글면 두 개가 따로 논다.
 *
 * 바탕은 검정이다. 학교 행사장 화면은 종이색이 잘 읽히지만,
 * 종이에 실제로 찍히는 건 사진이라 어두운 바탕이라야 사진이 산다.
 * (분경5컷 계열 프레임이 대체로 검정인 것도 같은 이유다.)
 */

/** 본문용 — 한글이 깨지지 않는 조합. 아이패드는 앞의 것, 윈도우는 뒤의 것을 쓴다. */
const FONT = "'Apple SD Gothic Neo', 'Malgun Gothic', system-ui, sans-serif";

const PAPER_BG = "#0A0A0A";
const MINT = "#3DDC97";

/**
 * 제목용 웹폰트의 실제 이름을 CSS 변수에서 꺼낸다.
 * next/font 가 이름을 해시로 바꾸기 때문에 문자열로 박아둘 수 없다.
 */
function displayFamily(): string {
  if (typeof document === "undefined") return "";
  return getComputedStyle(document.documentElement)
    .getPropertyValue("--font-bhs")
    .trim();
}

/**
 * CSS 의 object-fit: cover 와 같은 동작.
 * 비율을 유지한 채 칸을 꽉 채우고, 넘치는 부분은 잘라낸다.
 */
export function drawCover(
  ctx: CanvasRenderingContext2D,
  img: CanvasImageSource,
  sw: number,
  sh: number,
  x: number,
  y: number,
  w: number,
  h: number,
) {
  const scale = Math.max(w / sw, h / sh);
  const dw = sw * scale;
  const dh = sh * scale;
  ctx.drawImage(img, x + (w - dw) / 2, y + (h - dh) / 2, dw, dh);
}

function loadImage(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("사진을 불러오지 못했습니다"));
    img.src = src;
  });
}

/** 컷 아래 띠의 높이 */
const BAND_H = 74;

/**
 * 컷 아래에 학과 띠를 깐다.
 *
 * 예전엔 글자 길이만큼만 색을 칠한 작은 네모였는데, 컷마다 크기가 달라져서
 * 붙여놓은 스티커처럼 보였다. 이제는 **모든 컷이 같은 높이의 띠**를 갖는다 —
 * 크기가 같으면 규칙으로 읽힌다.
 *
 * 띠 색은 종이 바탕과 같은 검정이다. 그래서 컷 사이 간격과 이어져,
 * 사진이 아래가 두꺼운 테두리 안에 앉은 것처럼 보인다 (네컷 사진의 오래된 형태).
 * 학과 색은 왼쪽 끝 가는 막대에만 쓴다 — 다섯 색이 면으로 붙으면 서로 싸운다.
 */
function drawBand(
  ctx: CanvasRenderingContext2D,
  text: string,
  accent: string,
  mascot: HTMLImageElement | null,
  x: number,
  y: number,
  w: number,
  h: number,
) {
  const by = y + h - BAND_H;

  ctx.fillStyle = PAPER_BG;
  ctx.fillRect(x, by, w, BAND_H);

  // 학과 색은 여기 한 줄뿐
  const barW = 9;
  ctx.fillStyle = accent;
  ctx.fillRect(x, by, barW, BAND_H);

  // 마스코트가 오른쪽에 서므로 글자가 쓸 수 있는 폭이 그만큼 줄어든다.
  // 자리를 먼저 잡아두고 글자 크기를 거기에 맞춘다.
  let mascotW = 0;
  let mascotH = 0;

  if (mascot) {
    mascotH = Math.round(BAND_H * 2.1);
    mascotW = Math.round((mascot.naturalWidth / mascot.naturalHeight) * mascotH);
  }

  const textX = x + barW + 20;
  const textRoom = x + w - 16 - mascotW - 12 - textX;

  // 캔버스의 fillText 는 넘쳐도 알아서 줄이거나 접지 않는다.
  // 학과 이름 길이가 제각각이라(5~8자) 재보고 들어갈 때까지 줄인다.
  ctx.fillStyle = "#FFFFFF";
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";

  let fontSize = Math.round(BAND_H * 0.42);
  const minSize = Math.round(BAND_H * 0.26);

  while (fontSize > minSize) {
    ctx.font = `700 ${fontSize}px ${FONT}`;
    if (ctx.measureText(text).width <= textRoom) break;
    fontSize -= 1;
  }

  ctx.font = `700 ${fontSize}px ${FONT}`;
  ctx.fillText(text, textX, by + BAND_H / 2 + 2);

  // 마스코트는 띠를 딛고 서서 사진 쪽으로 올라온다.
  // 사진 위에 떠 있는 것보다 자리가 분명하고, 얼굴에서도 멀어진다.
  if (mascot) {
    ctx.drawImage(mascot, x + w - 16 - mascotW, by + BAND_H - mascotH, mascotW, mascotH);
  }
}

/**
 * 남는 한 칸 — 학교 이름이 들어간다.
 *
 * 예전엔 이 칸 전체가 민트 판이라 사진보다 밝았다. 종이에서 가장 먼저
 * 눈에 들어오는 게 브랜딩이면 순서가 뒤집힌 것이다.
 * 그래서 바탕은 검정으로 내리고 **민트는 아래 띠 하나에만** 남겼다.
 * 그 띠가 다른 다섯 컷의 띠와 같은 자리·같은 높이라 여섯 칸이 한 벌로 읽힌다.
 */
function drawBrand(
  ctx: CanvasRenderingContext2D,
  displayFont: string,
  symbol: HTMLImageElement | null,
) {
  const { x, y, w, h } = BRAND_CELL;
  const padX = 29; // 다른 컷의 글자 시작 위치와 맞춘다
  const top = h - BAND_H;

  ctx.fillStyle = PAPER_BG;
  ctx.fillRect(x, y, w, h);

  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";

  ctx.fillStyle = MINT;
  ctx.font = `400 ${Math.round(w * 0.205)}px ${displayFont}`;
  ctx.fillText("분경5컷", x + padX, y + top * 0.54);

  const now = new Date();
  const stamp = `${now.getFullYear()}.${String(now.getMonth() + 1).padStart(2, "0")}.${String(
    now.getDate(),
  ).padStart(2, "0")}`;
  ctx.fillStyle = "rgba(255,255,255,0.5)";
  ctx.font = `600 ${Math.round(w * 0.055)}px ${FONT}`;
  ctx.fillText(stamp, x + padX, y + top * 0.76);

  // 아래 띠 — 다섯 컷의 띠와 같은 자리, 같은 높이
  const by = y + h - BAND_H;
  ctx.fillStyle = MINT;
  ctx.fillRect(x, by, w, BAND_H);

  ctx.fillStyle = PAPER_BG;
  ctx.font = `700 ${Math.round(BAND_H * 0.4)}px ${FONT}`;
  ctx.textBaseline = "middle";
  ctx.fillText(SCHOOL_NAME, x + padX, by + BAND_H / 2 + 2);

  if (symbol) {
    const sh = Math.round(BAND_H * 0.66);
    const sw = Math.round((symbol.naturalWidth / symbol.naturalHeight) * sh);
    ctx.drawImage(symbol, x + w - 20 - sw, by + (BAND_H - sh) / 2, sw, sh);
  }
}

/**
 * 고른 사진 5장을 프레임에 합성해서 dataURL 로 돌려준다.
 * 화면 미리보기와 인쇄용이 같은 결과다 — 미리보기에서 본 게 종이에 나온다.
 *
 * @param shots 고른 순서대로 담긴 사진 dataURL 5개
 */
export async function composeFrame(shots: string[]): Promise<string> {
  if (shots.length !== SLOTS.length) {
    throw new Error(`사진이 ${SLOTS.length}장이어야 합니다 (받은 건 ${shots.length}장)`);
  }

  const family = displayFamily();
  const displayFont = family ? `${family}, ${FONT}` : FONT;

  // 캔버스는 화면과 달리 폰트를 알아서 기다려주지 않는다.
  // 아직 안 받아진 상태로 그리면 조용히 기본 글꼴로 찍힌다.
  if (family) {
    try {
      await document.fonts.load(`400 120px ${family}`, "분경5컷");
    } catch {
      // 폰트를 못 받아도 기본 글꼴로 그리면 된다
    }
  }

  const images = await Promise.all(shots.map(loadImage));

  // 심벌·마스코트는 없어도 인화는 되어야 한다. 못 받아오면 그냥 빼고 그린다.
  const symbol = await loadImage(SCHOOL_SYMBOL).catch(() => null);
  const mascots = await Promise.all(
    DEPARTMENTS.map((d) => loadImage(d.mascot).catch(() => null)),
  );

  const canvas = document.createElement("canvas");
  canvas.width = PAGE.w;
  canvas.height = PAGE.h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("캔버스를 쓸 수 없습니다");

  ctx.fillStyle = PAPER_BG;
  ctx.fillRect(0, 0, PAGE.w, PAGE.h);

  for (const slot of SLOTS) {
    const img = images[slot.index];
    const dept = DEPARTMENTS[slot.index];

    ctx.save();
    ctx.beginPath();
    ctx.rect(slot.x, slot.y, slot.w, slot.h);
    ctx.clip();
    drawCover(
      ctx,
      img,
      img.naturalWidth,
      img.naturalHeight,
      slot.x,
      slot.y,
      slot.w,
      slot.h,
    );
    drawBand(
      ctx,
      dept.name,
      dept.accent,
      mascots[slot.index],
      slot.x,
      slot.y,
      slot.w,
      slot.h,
    );
    ctx.restore();
  }

  drawBrand(ctx, displayFont, symbol);

  // PNG 로 뽑는다. 서버 API 명세가 image/png 이고, 저장 파일도 .png 다.
  // 손실 압축이 없어 인쇄에도 유리하다 — 대신 용량이 커서(수 MB) 업로드가 그만큼 걸린다.
  return canvas.toDataURL("image/png");
}
