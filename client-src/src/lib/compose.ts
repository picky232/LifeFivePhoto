import { PAGE, SLOTS } from "./frame";
import { DEFAULT_FRAME, type Frame } from "./frames";

/**
 * 브라우저에서만 도는 코드다 (canvas·Image 사용).
 * 클라이언트 컴포넌트에서만 import 할 것.
 *
 * ── 합성 방식 ──────────────────────────────────────────────
 * 여기서는 사진만 칸에 깔고, 그 위에 프레임 PNG 한 장을 덮는다.
 * 테두리·학과 이름표·로고는 전부 그 PNG 안에 그려져 있다.
 * 그래서 프레임 생김새를 바꿀 때 이 파일은 건드리지 않는다.
 *
 * 칸 자리는 frame.ts 의 SLOTS 가 정하고, PNG 의 뚫린 자리가 거기 맞아야 한다.
 * 맞는지는 scripts/check-frame.js 로 재볼 수 있다.
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
