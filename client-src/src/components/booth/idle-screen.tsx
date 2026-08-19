"use client";

import { useRef } from "react";
import Image from "next/image";
import { Screen } from "./screen";
import { DEPARTMENTS, SCHOOL_NAME, SCHOOL_SYMBOL } from "@/lib/departments";
import { PICK_COUNT, SHOT_COUNT } from "@/lib/frame";

/**
 * 대기 화면. 행사 내내 이 화면이 떠 있다가 학생이 두드리면 시작한다.
 *
 * 홀 반대편에서도 "저게 그거다"가 보여야 하므로 민트 한 면을 통째로 깔고
 * 제목을 화면 폭까지 키웠다. 포스터 한 장이라고 보면 된다.
 * 화면 전체가 버튼이다 — 어디를 눌러도 시작되어야 한다.
 */
export function IdleScreen({
  onStart,
  onOperator,
}: {
  onStart: () => void;
  onOperator: () => void;
}) {
  const holdTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  /** 운영자용 숨은 입구 — 왼쪽 위 모서리를 1.5초 누르면 진단 화면으로 */
  const startHold = () => {
    holdTimer.current = setTimeout(onOperator, 1500);
  };
  const cancelHold = () => {
    if (holdTimer.current) clearTimeout(holdTimer.current);
    holdTimer.current = null;
  };

  return (
    <Screen tone="mint" className="relative">
      {/* 운영자 입구. 눈에 안 보이지만 학생이 실수로 못 열 만큼은 길게 눌러야 한다 */}
      <button
        type="button"
        aria-label="운영자 화면"
        className="absolute top-0 left-0 z-20 h-20 w-20 opacity-0"
        onPointerDown={startHold}
        onPointerUp={cancelHold}
        onPointerLeave={cancelHold}
      />

      <button
        type="button"
        onClick={onStart}
        className="flex flex-1 flex-col text-left"
      >
        <div className="border-ink flex items-center justify-between border-b pb-3">
          <span className="flex items-center gap-3">
            <span className="relative h-9 w-9">
              <Image src={SCHOOL_SYMBOL} alt="" fill sizes="36px" className="object-contain" />
            </span>
            <span className="text-xl font-bold">{SCHOOL_NAME}</span>
          </span>
          <span className="text-xl font-bold">학과 홍보 포토부스</span>
        </div>

        <h1 className="headline mt-10 text-[10rem]">분경5컷</h1>

        <p className="mt-6 max-w-2xl text-3xl leading-snug font-semibold">
          {SHOT_COUNT}장을 찍고 {PICK_COUNT}장을 골라 그 자리에서 인화합니다.
          <br />
          <span className="text-ink/55">
            컷 하나에 학과 하나. 다섯 컷이 곧 우리 학교 다섯 학과입니다.
          </span>
        </p>

        <div className="flex-1" />

        {/* 학과 다섯. 학교 공식 마스코트를 그대로 쓴다 —
            학생들이 이미 아는 그림이라 학과가 즉시 붙는다.
            색은 여기서 쓰지 않는다. 색과 컷의 짝은 고를 때 뜻이 생긴다. */}
        <div className="border-ink grid grid-cols-5 border-t">
          {DEPARTMENTS.map((d, i) => (
            <div
              key={d.id}
              className={`px-3 pt-4 pb-5 ${i > 0 ? "border-ink/30 border-l" : ""}`}
            >
              <div className="relative mx-auto h-36 w-full">
                <Image
                  src={d.mascot}
                  alt=""
                  fill
                  sizes="180px"
                  className="object-contain object-bottom"
                />
              </div>
              <p className="mt-3 text-2xl font-bold">{d.name}</p>
              <p className="text-ink/70 mt-1 text-base leading-snug">{d.tagline}</p>
            </div>
          ))}
        </div>

        {/* 시작 — 민트 면 위에서 가장 진한 덩어리라 여기로 눈이 간다 */}
        <div className="bg-ink text-paper mt-8 flex items-center justify-between px-10 py-9">
          <span className="headline text-5xl">화면을 눌러 시작하기</span>
          <span className="text-5xl" aria-hidden>
            →
          </span>
        </div>
      </button>
    </Screen>
  );
}
