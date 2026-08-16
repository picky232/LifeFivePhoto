/**
 * 노트북 서버로 완성본을 올린다.
 *
 * 명세는 저장소의 기획서.md 6장 "API 명세서" 를 그대로 따른다.
 *   POST /upload   multipart/form-data
 *     photo : File  (image/png — canvas.toBlob() 결과)
 *     phone : string
 *   200 { success: true,  filename: "2026-08-13/01012345678.png" }
 *   400 { success: false, error: "전화번호가 없습니다." }
 *   500 { success: false, error: "파일 저장에 실패했습니다." }
 *
 * ── 주소를 왜 상대경로로 두는가 ─────────────────────────────
 * 이 앱은 그 서버가 정적 파일로 서빙한다. 즉 같은 출처다.
 * 그래서 "/upload" 로 보내면 주소를 어디에도 박아둘 필요가 없고,
 * 핫스팟 IP 가 바뀌어도 따라간다. 혼합 콘텐츠·CORS 문제도 생기지 않는다.
 *
 * 개발 중에는(Next dev 서버) 그 경로가 없으므로,
 * NEXT_PUBLIC_UPLOAD_BASE 로 노트북 주소를 넣어 시험할 수 있다.
 */

const BASE = process.env.NEXT_PUBLIC_UPLOAD_BASE ?? "";

/** 업로드가 오래 걸려도 여기서 끊는다. PNG 가 수 MB 라 핫스팟에서는 느릴 수 있다. */
const TIMEOUT_MS = 60_000;

export type UploadResult =
  | { ok: true; filename: string }
  | { ok: false; error: string };

/** 서버가 돌려주는 몸통 */
type ServerBody = {
  success?: boolean;
  filename?: string;
  error?: string;
};

/**
 * dataURL 을 Blob 으로 바꾼다.
 * 합성은 이미 끝났으므로 다시 그리지 않고 문자열만 되돌린다.
 */
function dataUrlToBlob(dataUrl: string): Blob {
  const comma = dataUrl.indexOf(",");
  if (comma < 0) throw new Error("이미지 형식이 올바르지 않습니다");

  const meta = dataUrl.slice(0, comma);
  const type = meta.match(/data:([^;]+)/)?.[1] ?? "image/png";
  const binary = atob(dataUrl.slice(comma + 1));

  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);

  return new Blob([bytes], { type });
}

/**
 * 완성본 한 장을 올린다.
 *
 * 실패해도 예외를 던지지 않고 결과로 돌려준다 — 부스에서는 화면에 사유를
 * 보여주고 다시 시도할 수 있어야지, 흐름이 끊기면 안 된다.
 *
 * 자동 재시도는 하지 않는다. 서버가 같은 날 같은 번호를 덮어쓰지 않고
 * `01012345678_2.png` 로 남기기 때문에, 무턱대고 다시 보내면 사본이 쌓인다.
 */
export async function uploadFrame(
  frameDataUrl: string,
  phone: string,
): Promise<UploadResult> {
  let blob: Blob;
  try {
    blob = dataUrlToBlob(frameDataUrl);
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "이미지 변환 실패" };
  }

  const form = new FormData();
  // 필드 이름과 순서는 명세 그대로. 서버가 phone 을 파일명으로 쓴다.
  form.append("phone", phone);
  form.append("photo", blob, "capture.png");

  const abort = new AbortController();
  const timer = setTimeout(() => abort.abort(), TIMEOUT_MS);

  try {
    const res = await fetch(`${BASE}/upload`, {
      method: "POST",
      body: form,
      signal: abort.signal,
    });

    // 서버가 JSON 이 아닌 걸 돌려줄 수도 있다 (프록시 오류 페이지 등)
    let body: ServerBody = {};
    try {
      body = (await res.json()) as ServerBody;
    } catch {
      return { ok: false, error: `서버 응답을 읽지 못했습니다 (${res.status})` };
    }

    if (res.ok && body.success && body.filename) {
      return { ok: true, filename: body.filename };
    }
    return { ok: false, error: body.error ?? `업로드 실패 (${res.status})` };
  } catch (e) {
    if (e instanceof DOMException && e.name === "AbortError") {
      return { ok: false, error: "서버가 응답하지 않습니다 (시간 초과)" };
    }
    // 대개 핫스팟이 끊겼거나 서버가 안 떠 있는 경우다
    return { ok: false, error: "서버에 연결하지 못했습니다" };
  } finally {
    clearTimeout(timer);
  }
}

/** 서버가 살아 있는지 확인한다. 운영자 화면에서 쓴다. */
export async function checkServer(): Promise<boolean> {
  try {
    const res = await fetch(`${BASE}/health`, { signal: AbortSignal.timeout(5000) });
    if (!res.ok) return false;
    const body = (await res.json()) as { status?: string };
    return body.status === "ok";
  } catch {
    return false;
  }
}
