"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { CUT_RATIO } from "@/lib/frame";
import { drawCover } from "@/lib/compose";

export type CameraState = "idle" | "starting" | "ready" | "error";

/** 저장할 컷의 긴 변 상한. 8장을 메모리에 들고 있어야 하니 무제한으로 두지 않는다. */
const MAX_EDGE = 1200;

/**
 * 부스용 카메라.
 *
 * 촬영 화면에 들어오기 전에 start() 를 불러두면 대기 시간이 사라진다.
 * grab() 은 화면에 보이던 그대로(컷 비율로 잘라서) dataURL 을 돌려준다.
 *
 * ★ 스트림을 붙이는 시점이 까다롭다.
 * 안내 화면에서 미리 카메라를 켜는데, 그때 화면에는 <video> 가 아직 없다.
 * 그래서 "스트림을 받았을 때 붙인다"로 짜면 붙일 대상이 없어 조용히 실패하고,
 * 촬영 화면에서 <video> 가 생겨도 아무도 다시 붙여주지 않는다.
 * 그래서 ref 를 콜백으로 받아 **요소가 나타나는 순간**에도 붙인다.
 */
export function useCamera() {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [state, setState] = useState<CameraState>("idle");
  const [error, setError] = useState("");

  /** 스트림과 요소가 둘 다 있을 때만 실제로 연결한다 */
  const bind = useCallback(() => {
    const el = videoRef.current;
    const stream = streamRef.current;
    if (!el || !stream) return;
    if (el.srcObject === stream) return; // 이미 붙어 있으면 건드리지 않는다
    el.srcObject = stream;
    // 재생이 거부돼도(자동재생 정책) 부스가 멈출 이유는 아니다
    void el.play().catch(() => {});
  }, []);

  /**
   * <video ref={attachVideo}> 로 넘긴다.
   * React 가 요소를 붙이거나 떼는 순간 불러주므로, 여기서 연결하면 순서 문제가 사라진다.
   */
  const attachVideo = useCallback(
    (el: HTMLVideoElement | null) => {
      videoRef.current = el;
      bind();
    },
    [bind],
  );

  const stop = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    setState("idle");
  }, []);

  const start = useCallback(async () => {
    if (streamRef.current) {
      bind(); // 스트림은 이미 있고 요소만 새로 생긴 경우
      return;
    }
    setState("starting");
    setError("");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        // 셀프 촬영이라 전면 카메라
        video: { facingMode: "user", width: { ideal: 1920 }, height: { ideal: 1440 } },
        audio: false,
      });
      streamRef.current = stream;

      // 스트림이 끊기는 것을 잡아둔다.
      //
      // 아이패드에서 홈으로 나갔다 오거나 화면이 잠기면 트랙이 끝난다. 그때
      // <video> 는 마지막 장면을 그대로 물고 있어 화면은 멀쩡해 보이는데
      // grab() 은 아무것도 못 집는다. 촬영 화면이 그걸 모르면 카운트다운이
      // 멈춘 채 몇 장 찍다 만 자리에서 영영 서 있게 된다.
      for (const track of stream.getTracks()) {
        track.addEventListener("ended", () => {
          // 이미 다른 스트림으로 갈아탄 뒤 늦게 온 신호는 흘린다
          if (streamRef.current !== stream) return;
          streamRef.current = null;
          setError("카메라 연결이 끊겼습니다.");
          setState("error");
        });
      }

      bind();
      setState("ready");
    } catch (e) {
      // 대부분 HTTPS 가 아니거나(NotAllowedError) 권한을 거부한 경우다
      setError(e instanceof Error ? `${e.name}: ${e.message}` : String(e));
      setState("error");
    }
  }, [bind]);

  // 화면을 벗어나면 카메라를 놓아준다
  useEffect(() => stop, [stop]);

  /**
   * 한 장 찍는다.
   * - 컷 비율(CUT_RATIO)로 가운데를 잘라낸다 → 미리보기와 결과가 같다
   * - 셀카는 좌우 반전된 화면을 보고 찍으므로 결과물도 뒤집어 맞춘다
   */
  const grab = useCallback((): string | null => {
    const video = videoRef.current;
    if (!video || !video.videoWidth) return null;

    const sw = video.videoWidth;
    const sh = video.videoHeight;

    // 잘라낼 크기를 먼저 정하고, 상한을 넘으면 줄인다
    let w: number;
    let h: number;
    if (sw / sh > CUT_RATIO) {
      h = sh;
      w = sh * CUT_RATIO;
    } else {
      w = sw;
      h = sw / CUT_RATIO;
    }
    const shrink = Math.min(1, MAX_EDGE / Math.max(w, h));
    w = Math.round(w * shrink);
    h = Math.round(h * shrink);

    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;

    ctx.translate(w, 0);
    ctx.scale(-1, 1);
    drawCover(ctx, video, sw, sh, 0, 0, w, h);

    return canvas.toDataURL("image/jpeg", 0.92);
  }, []);

  return { attachVideo, state, error, start, stop, grab };
}
