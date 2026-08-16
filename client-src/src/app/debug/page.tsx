"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  CUT,
  CUT_RATIO,
  PAGE,
  PAGE_INCH,
  PRINT_DPI,
  SHOOT_INTERVAL,
  SHOT_COUNT,
} from "@/lib/frame";
import { checkServer } from "@/lib/upload";

/** iOS 사파리 전용 레거시 플래그 (홈 화면 실행 여부) */
type IosNavigator = Navigator & { standalone?: boolean };

type Check = {
  label: string;
  value: string;
  ok: boolean | null; // null = 판정 대상 아님, 참고값
  note?: string;
};

/**
 * 이 기기가 부스를 돌릴 수 있는 상태인지 재본다.
 *
 * 브라우저 API만 쓰므로 컴포넌트 밖에 둔다. 반드시 화면이 한 번 그려진 뒤에
 * 불러야 한다 — env(safe-area-inset-*) 은 첫 페인트 전에 재면 0으로 나온다.
 */
function measure(): Check[] {
  const nav = navigator as IosNavigator;

  const displayModeStandalone =
    window.matchMedia?.("(display-mode: standalone)").matches ?? false;
  const iosStandalone = nav.standalone === true;
  const standalone = displayModeStandalone || iosStandalone;

  // iOS 버전은 UA에서 "OS 17_5_1" 형태로 뽑는다
  const iosMatch = navigator.userAgent.match(/OS (\d+)[._](\d+)(?:[._](\d+))?/);
  const iosVersion = iosMatch
    ? `${iosMatch[1]}.${iosMatch[2]}${iosMatch[3] ? "." + iosMatch[3] : ""}`
    : "확인 불가";
  const iosMajor = iosMatch ? Number(iosMatch[1]) : null;
  const iosMinor = iosMatch ? Number(iosMatch[2]) : 0;
  const atLeast = (maj: number, min: number) =>
    iosMajor === null ? null : iosMajor > maj || (iosMajor === maj && iosMinor >= min);

  // safe-area 값은 CSS env()를 실제로 적용해 재야 알 수 있다
  const probe = document.createElement("div");
  probe.style.cssText =
    "position:fixed;top:0;left:0;visibility:hidden;" +
    "padding-top:env(safe-area-inset-top);padding-bottom:env(safe-area-inset-bottom);" +
    "padding-left:env(safe-area-inset-left);padding-right:env(safe-area-inset-right)";
  document.body.appendChild(probe);
  const cs = getComputedStyle(probe);
  const safeArea = `상 ${cs.paddingTop} · 하 ${cs.paddingBottom} · 좌 ${cs.paddingLeft} · 우 ${cs.paddingRight}`;
  probe.remove();

  // 타입상 mediaDevices 는 항상 있지만, http 로 열면 실제로는 undefined 다.
  // 그래서 진릿값이 아니라 typeof 로 확인한다.
  const hasCamera = typeof navigator.mediaDevices?.getUserMedia === "function";

  return [
    {
      label: "실행 모드",
      value: standalone ? "전체화면 (홈 화면 앱)" : "브라우저 (주소창 있음)",
      ok: standalone,
      note: standalone
        ? "주소창·툴바 없이 뜨는 상태입니다"
        : "사파리 공유 → 홈 화면에 추가 → 그 아이콘으로 다시 여세요",
    },
    {
      label: "보안 컨텍스트",
      value: window.isSecureContext ? "HTTPS (secure)" : "안전하지 않음",
      ok: window.isSecureContext,
      note: window.isSecureContext ? undefined : "이 상태면 카메라가 절대 안 열립니다",
    },
    {
      label: "카메라 API",
      value: hasCamera ? "getUserMedia 있음" : "없음",
      ok: hasCamera,
    },
    {
      label: "iOS 버전",
      value: iosVersion,
      ok: atLeast(14, 3),
      note: "홈 화면 앱에서 카메라를 쓰려면 14.3 이상",
    },
    {
      label: "화면 꺼짐 방지",
      value: "wakeLock" in navigator ? "지원함" : "지원 안 함",
      ok: "wakeLock" in navigator,
      note: "Safari 16.4 이상에서 지원",
    },
    {
      label: "화면 크기",
      value: `${window.innerWidth} × ${window.innerHeight} · DPR ${window.devicePixelRatio}`,
      ok: null,
    },
    { label: "안전 영역 여백", value: safeArea, ok: null },
    {
      label: "화면 방향",
      value: window.innerWidth > window.innerHeight ? "가로" : "세로",
      ok: null,
      note: "부스는 세로 기준으로 만들었습니다",
    },
  ];
}

/**
 * 운영자·개발자용 진단 화면.
 * 대기 화면 왼쪽 위 모서리를 1.5초 누르면 여기로 온다.
 */
export default function DiagnosticsPage() {
  const [checks, setChecks] = useState<Check[]>([]);
  const [camState, setCamState] = useState<"idle" | "starting" | "on" | "error">("idle");
  const [camError, setCamError] = useState<string>("");
  const [facing, setFacing] = useState<"user" | "environment">("user");
  const [shot, setShot] = useState<string | null>(null);
  const [wakeMsg, setWakeMsg] = useState<string>("");
  const [serverMsg, setServerMsg] = useState<string>("");

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // 한 프레임 기다린 뒤에 잰다. 안전 영역 값이 페인트 후에야 확정되기 때문이다.
  useEffect(() => {
    const id = requestAnimationFrame(() => setChecks(measure()));
    return () => cancelAnimationFrame(id);
  }, []);

  /* ── 카메라 ──────────────────────────────────────────── */
  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    setCamState("idle");
  }, []);

  const startCamera = useCallback(
    async (mode: "user" | "environment") => {
      setCamState("starting");
      setCamError("");
      stopCamera();
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: mode, width: { ideal: 1920 }, height: { ideal: 1080 } },
          audio: false,
        });
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }
        setFacing(mode);
        setCamState("on");
      } catch (e) {
        setCamError(e instanceof Error ? `${e.name}: ${e.message}` : String(e));
        setCamState("error");
      }
    },
    [stopCamera],
  );

  useEffect(() => stopCamera, [stopCamera]);

  const capture = useCallback(() => {
    const video = videoRef.current;
    if (!video || !video.videoWidth) return;
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    if (facing === "user") {
      // 셀카는 좌우 반전된 화면을 보고 찍으므로 결과물도 뒤집어 맞춘다
      ctx.translate(canvas.width, 0);
      ctx.scale(-1, 1);
    }
    ctx.drawImage(video, 0, 0);
    setShot(canvas.toDataURL("image/jpeg", 0.9));
  }, [facing]);

  const requestWakeLock = useCallback(async () => {
    try {
      const anyNav = navigator as Navigator & {
        wakeLock?: { request: (type: "screen") => Promise<unknown> };
      };
      if (!anyNav.wakeLock) {
        setWakeMsg("이 기기에서는 지원하지 않습니다");
        return;
      }
      await anyNav.wakeLock.request("screen");
      setWakeMsg("잠금 성공 — 이제 화면이 안 꺼집니다");
    } catch (e) {
      setWakeMsg(e instanceof Error ? `실패: ${e.message}` : "실패");
    }
  }, []);

  const btn =
    "border-ink border-2 px-4 py-3 text-sm font-bold active:bg-ink active:text-paper disabled:opacity-25";

  /* ── 화면 ────────────────────────────────────────────── */
  return (
    <main
      className="flex-1 px-6 py-6"
      style={{
        paddingTop: "calc(env(safe-area-inset-top) + 1.5rem)",
        paddingBottom: "calc(env(safe-area-inset-bottom) + 1.5rem)",
      }}
    >
      <header className="border-ink flex items-start justify-between gap-4 border-b pb-4">
        <div>
          <p className="text-ink-60 text-sm font-bold">분당경영고 인생네컷 · 운영자</p>
          <h1 className="headline mt-1 text-4xl">환경 확인</h1>
          <p className="text-ink-60 mt-1 text-sm">
            전체화면으로 뜨는지, 카메라가 열리는지 이 화면에서 판정합니다.
          </p>
        </div>
        <Link href="/" className={`${btn} shrink-0`}>
          부스로
        </Link>
      </header>

      <section className="mt-6">
        {checks.map((c) => (
          <div
            key={c.label}
            className="border-ink/15 flex items-start gap-3 border-b py-3"
          >
            <span className="mt-0.5 w-5 shrink-0 text-center">
              {c.ok === null ? "·" : c.ok ? "✅" : "❌"}
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-baseline gap-x-2">
                <span className="text-ink-60 text-sm">{c.label}</span>
                <span className="font-mono text-sm break-all">{c.value}</span>
              </div>
              {c.note && <p className="text-ink-60 mt-0.5 text-xs">{c.note}</p>}
            </div>
          </div>
        ))}
        {checks.length === 0 && (
          <p className="text-ink-60 py-6 text-sm">측정 중…</p>
        )}
      </section>

      {/* 규격이 코드와 어긋나지 않는지 눈으로 확인하는 칸 */}
      <section className="mt-8">
        <h2 className="text-ink-60 mb-3 text-sm font-bold">현재 프레임 규격</h2>
        <dl className="grid grid-cols-2 gap-y-2 font-mono text-sm">
          <dt className="text-ink-60">용지</dt>
          <dd>
            {PAGE_INCH.w}×{PAGE_INCH.h}인치
          </dd>
          <dt className="text-ink-60">합성 해상도</dt>
          <dd>
            {PAGE.w}×{PAGE.h}px · {PRINT_DPI}dpi
          </dd>
          <dt className="text-ink-60">컷 한 칸</dt>
          <dd>
            {CUT.w}×{CUT.h}px · 비율 {CUT_RATIO.toFixed(3)}
          </dd>
          <dt className="text-ink-60">촬영</dt>
          <dd>
            {SHOT_COUNT}장 · {SHOOT_INTERVAL}초 간격
          </dd>
        </dl>
      </section>

      <section className="mt-8">
        <h2 className="text-ink-60 mb-3 text-sm font-bold">카메라</h2>

        <div className="relative mb-3 aspect-[3/4] w-full overflow-hidden bg-black">
          <video
            ref={videoRef}
            playsInline
            muted
            autoPlay
            className="h-full w-full object-cover"
            style={{ transform: facing === "user" ? "scaleX(-1)" : undefined }}
          />
          {camState !== "on" && (
            <div className="text-paper/50 absolute inset-0 grid place-items-center px-6 text-center text-sm">
              {camState === "idle" && "아래 버튼을 눌러 카메라를 켜세요"}
              {camState === "starting" && "카메라 여는 중…"}
              {camState === "error" && (
                <span className="text-red-400">
                  열기 실패
                  <br />
                  <span className="font-mono text-xs break-all">{camError}</span>
                </span>
              )}
            </div>
          )}
        </div>

        <div className="flex flex-wrap gap-2">
          <button onClick={() => startCamera("user")} className={btn}>
            전면 카메라
          </button>
          <button onClick={() => startCamera("environment")} className={btn}>
            후면 카메라
          </button>
          <button onClick={capture} disabled={camState !== "on"} className={btn}>
            한 장 찍기
          </button>
          <button onClick={stopCamera} disabled={camState !== "on"} className={btn}>
            끄기
          </button>
        </div>
      </section>

      {shot && (
        <section className="mt-8">
          <h2 className="text-ink-60 mb-3 text-sm font-bold">
            캡처 결과 (캔버스로 그린 것)
          </h2>
          {/* 진단용 즉석 미리보기라 next/image 대신 원본 data URL을 그대로 씁니다 */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={shot} alt="캡처 결과" className="w-full" />
        </section>
      )}

      {/* 행사장에서 제일 먼저 확인할 것 — 노트북 서버가 살아 있는가 */}
      <section className="mt-8">
        <h2 className="text-ink-60 mb-3 text-sm font-bold">서버 연결</h2>
        <button
          onClick={async () => {
            setServerMsg("확인 중…");
            const ok = await checkServer();
            setServerMsg(
              ok
                ? "✅ 서버 응답 정상 (/health)"
                : "❌ 서버에 연결되지 않습니다. 노트북 서버와 핫스팟을 확인하세요",
            );
          }}
          className={btn}
        >
          서버 확인
        </button>
        {serverMsg && <p className="text-ink-60 mt-2 text-sm">{serverMsg}</p>}
      </section>

      <section className="mt-8">
        <h2 className="text-ink-60 mb-3 text-sm font-bold">화면 꺼짐 방지</h2>
        <button onClick={requestWakeLock} className={btn}>
          화면 잠금 요청
        </button>
        {wakeMsg && <p className="text-ink-60 mt-2 text-sm">{wakeMsg}</p>}
      </section>
    </main>
  );
}
