import { PAGE, SLOTS } from "./frame";
import { DEFAULT_FRAME, type Frame } from "./frames";

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


/**
 * CSS 의 object-fit: cover 와 같은 동작.
 * 비율을 유지한 채 칸을 꽉 채우고, 넘치는 부분은 잘라낸다.
 */
/** 프레임이 통째로 투명한 경우를 대비한 바탕색 */
const PAPER_BG = "#0A0A0A";

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

export async function composeFrame(
  shots: string[],
  frame: Frame = DEFAULT_FRAME,
): Promise<string> {
  if (shots.length !== SLOTS.length) {
    throw new Error(`사진이 ${SLOTS.length}장이어야 합니다 (받은 건 ${shots.length}장)`);
  }

  const images = await Promise.all(shots.map(loadImage));

  // 프레임을 못 받아오면 인화할 수 없다. 사진만 남기면 테두리도 학과 이름도
  // 없는 그림이 나가는데, 그건 결과물이라고 할 수 없다.
  const overlay = await loadImage(frame.image);

  const canvas = document.createElement("canvas");
  canvas.width = PAGE.w;
  canvas.height = PAGE.h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("캔버스를 쓸 수 없습니다");

  // 프레임에 뚫려 있지 않은 자리는 프레임이 덮으므로 바탕색은 보이지 않는다.
  // 다만 프레임이 통째로 투명한 경우를 대비해 한 번 칠해 둔다.
  ctx.fillStyle = PAPER_BG;
  ctx.fillRect(0, 0, PAGE.w, PAGE.h);

  for (const slot of SLOTS) {
    const img = images[slot.index];

    ctx.save();
    ctx.beginPath();
    ctx.rect(slot.x, slot.y, slot.w, slot.h);
    ctx.clip();
    drawCover(ctx, img, img.naturalWidth, img.naturalHeight, slot.x, slot.y, slot.w, slot.h);
    ctx.restore();
  }

  ctx.drawImage(overlay, 0, 0, PAGE.w, PAGE.h);

  // PNG 로 뽑는다. 서버 API 명세가 image/png 이고, 저장 파일도 .png 다.
  // 손실 압축이 없어 인쇄에도 유리하다 - 대신 용량이 커서 업로드가 그만큼 걸린다.
  return canvas.toDataURL("image/png");
}
