"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { useCamera } from "@/hooks/use-camera";
import { useWakeLock } from "@/hooks/use-wake-lock";
import { IDLE_RESET_SECONDS } from "@/lib/frame";

import { IdleScreen } from "@/components/booth/idle-screen";
import { SplashScreen } from "@/components/booth/splash-screen";
import { GuideScreen } from "@/components/booth/guide-screen";
import { ShootScreen } from "@/components/booth/shoot-screen";
import { SelectScreen } from "@/components/booth/select-screen";
import { PreviewScreen } from "@/components/booth/preview-screen";
import { PhoneScreen } from "@/components/booth/phone-screen";
import { PrintingScreen } from "@/components/booth/printing-screen";
import { DoneScreen } from "@/components/booth/done-screen";

type Step =
  | "idle"
  | "splash"
  | "guide"
  | "shoot"
  | "select"
  | "preview"
  | "phone"
  | "printing"
  | "done";

/** 손을 놓아도 다음 사람이 쓸 수 있게 처음으로 되돌리는 단계들 */
const RESETTABLE: Step[] = ["splash", "guide", "shoot", "select", "preview", "phone"];

/**
 * 부스 본체.
 *
 * 라우팅을 쓰지 않고 한 화면에서 단계만 바꾼다. 이유가 두 가지다.
 * - 카메라 스트림이 화면을 옮겨도 끊기지 않는다 (다시 켜는 데 1초쯤 걸린다)
 * - 브라우저 뒤로가기·주소 이동 같은 탈출 경로가 생기지 않는다 (키오스크)
 */
export default function BoothPage() {
  const router = useRouter();
  const camera = useCamera();
  const wakeLock = useWakeLock();

  // 훅이 돌려주는 함수는 안정적이지만 camera 객체 자체는 매 렌더 새로 만들어진다.
  // 아래 콜백들이 매 렌더 바뀌면 자식의 타이머가 계속 초기화되므로 함수만 꺼내 쓴다.
  const { start: startCamera, stop: stopCamera } = camera;
  const { acquire: keepAwake, release: letSleep } = wakeLock;

  const [step, setStep] = useState<Step>("idle");
  const [shots, setShots] = useState<string[]>([]);
  const [picked, setPicked] = useState<string[]>([]);
  const [frame, setFrame] = useState<string | null>(null);
  const [phone, setPhone] = useState<string | null>(null);

  const reset = useCallback(() => {
    stopCamera();
    letSleep();
    setShots([]);
    setPicked([]);
    setFrame(null);
    setPhone(null);
    setStep("idle");
  }, [stopCamera, letSleep]);

  /* ── 단계 이동 ────────────────────────────────────────── */

  const begin = useCallback(() => {
    void keepAwake();
    // 스플래시·안내가 지나가는 동안 카메라를 미리 켜둔다
    // → 촬영 화면에 도착했을 때 기다림이 없다
    void startCamera();
    setStep("splash");
  }, [keepAwake, startCamera]);

  // 스플래시의 타이머가 매 렌더마다 초기화되지 않도록 고정해둔다
  const toGuide = useCallback(() => setStep("guide"), []);

  const shootDone = useCallback((taken: string[]) => {
    setShots(taken);
    // 고르는 동안은 카메라가 필요 없다. 켜둬면 기기가 뜨거워지고 배터리를 먹는다.
    stopCamera();
    setStep("select");
  }, [stopCamera]);

  const retake = useCallback(() => {
    setShots([]);
    void startCamera();
    setStep("shoot");
  }, [startCamera]);

  const selectDone = useCallback((chosen: string[]) => {
    setPicked(chosen);
    setStep("preview");
  }, []);

  const previewDone = useCallback((composed: string) => {
    setFrame(composed);
    setStep("phone");
  }, []);

  // 번호는 필수다. 서버가 번호를 파일명으로 쓰기 때문에, 번호가 없으면
  // 사진이 노트북에 저장되지 않고 뽑을 파일도 안 생긴다.
  const submitPhone = useCallback((value: string) => {
    setPhone(value);
    setStep("printing");
  }, []);

  const printDone = useCallback(() => setStep("done"), []);

  /* 지금 어느 단계인지 html 에 남긴다.
     고르는 화면은 사진 여덟 장이 자리를 많이 써서 가로에서 글자를 더
     줄여야 한다. 화면마다 크기를 달리하려면 뿌리에 표시가 필요하다. */
  useEffect(() => {
    document.documentElement.dataset.step = step;
    return () => {
      delete document.documentElement.dataset.step;
    };
  }, [step]);

  /* ── 방치 감지 ────────────────────────────────────────── */
  useEffect(() => {
    if (!RESETTABLE.includes(step)) return;

    let timer: ReturnType<typeof setTimeout>;
    const arm = () => {
      clearTimeout(timer);
      timer = setTimeout(reset, IDLE_RESET_SECONDS * 1000);
    };

    arm();
    window.addEventListener("pointerdown", arm);
    return () => {
      clearTimeout(timer);
      window.removeEventListener("pointerdown", arm);
    };
  }, [step, reset]);

  /* ── 화면 ────────────────────────────────────────────── */
  switch (step) {
    case "idle":
      return <IdleScreen onStart={begin} onOperator={() => router.push("/debug")} />;

    case "splash":
      return <SplashScreen onDone={toGuide} />;

    case "guide":
      return (
        <GuideScreen
          cameraState={camera.state}
          cameraError={camera.error}
          onNext={() => setStep("shoot")}
          onCancel={reset}
          onRetryCamera={() => void startCamera()}
        />
      );

    case "shoot":
      return <ShootScreen camera={camera} onDone={shootDone} onCancel={reset} />;

    case "select":
      return <SelectScreen shots={shots} onDone={selectDone} onRetake={retake} />;

    case "preview":
      return (
        <PreviewScreen
          shots={picked}
          onBack={() => setStep("select")}
          onConfirm={previewDone}
        />
      );

    case "phone":
      return (
        <PhoneScreen onSubmit={submitPhone} onBack={() => setStep("preview")} />
      );

    case "printing":
      // 번호 없이는 이 단계에 올 수 없다 (PhoneScreen 이 막는다)
      return <PrintingScreen frame={frame} phone={phone ?? ""} onDone={printDone} />;

    case "done":
      return <DoneScreen onReset={reset} />;
  }
}
