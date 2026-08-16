"use client";

import { useEffect } from "react";
import Image from "next/image";
import { Screen } from "./screen";
import { MADE_BY, SCHOOL_NAME, SCHOOL_SYMBOL } from "@/lib/departments";

/** 스플래시가 떠 있는 시간(ms) */
const HOLD = 2900;

/**
 * 시작을 누르면 한 번 지나가는 스플래시.
 *
 * 설계서에 "학교명 + 제작자, 넷플릭스 인트로 느낌"이라고 적혀 있다.
 * 그 느낌의 핵심은 화려함이 아니라 **순서**다 — 심벌이 먼저 박히고,
 * 이름이 차례로 올라오고, 끝난다. 그래서 요소마다 시작 시각만 달리 줬다.
 *
 * 대기 화면과 다른 물건이다. 대기 화면은 계속 떠 있는 포스터고,
 * 이건 지나가는 연출이라 되돌아오지 않는다.
 */
export function SplashScreen({ onDone }: { onDone: () => void }) {
  useEffect(() => {
    const t = setTimeout(onDone, HOLD);
    return () => clearTimeout(t);
  }, [onDone]);

  return (
    <Screen tone="mint">
      {/* 기다리기 싫으면 눌러서 건너뛴다 */}
      <button
        type="button"
        onClick={onDone}
        className="flex flex-1 flex-col items-center justify-center text-center"
      >
        <div className="animate-stamp relative h-52 w-52">
          <Image
            src={SCHOOL_SYMBOL}
            alt=""
            fill
            priority
            sizes="208px"
            className="object-contain"
          />
        </div>

        <p
          className="animate-slide mt-10 text-3xl font-bold"
          style={{ animationDelay: "420ms" }}
        >
          {SCHOOL_NAME}
        </p>

        <h1
          className="headline animate-slide mt-4 text-[9rem]"
          style={{ animationDelay: "700ms" }}
        >
          인생네컷
        </h1>

        <div
          className="animate-slide border-ink mt-12 border-t pt-5"
          style={{ animationDelay: "1150ms" }}
        >
          <p className="text-ink/60 text-lg font-semibold tracking-[0.2em]">
            만든 사람
          </p>
          <p className="mt-1.5 flex items-center gap-4 text-2xl font-bold">
            {MADE_BY.map((name, i) => (
              <span key={name} className="flex items-center gap-4">
                {i > 0 && <span className="text-ink/30">·</span>}
                {name}
              </span>
            ))}
          </p>
        </div>
      </button>
    </Screen>
  );
}
