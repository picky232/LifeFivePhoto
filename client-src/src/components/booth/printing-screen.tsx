"use client";

import { useEffect, useState } from "react";
import { Screen, TopRule } from "./screen";
import { PAGE_RATIO, PRINT_SECONDS } from "@/lib/frame";

/**
 * 인화 대기 화면.
 *
 * 기다리는 동안 볼 게 없으면 시간이 두 배로 느껴진다. 그래서 남은 초를
 * 화면에서 가장 큰 것으로 두고, 무엇이 나오고 있는지도 같이 보여준다.
 *
 * ⚠️ 지금은 시간만 흘려보내는 껍데기다. 실제 인쇄 요청(/api/print)은 아직 없다 —
 *    프린터 연결 방식(윈도우 노트북)이 확정되면 여기서 호출하고,
 *    남은 시간도 서버가 알려주는 진행 상태로 바꿔야 한다.
 */
export function PrintingScreen({
  frame,
  phone,
  onDone,
}: {
  /** 인쇄로 보내는 그 그림 — 무엇이 나오는지 보여준다 */
  frame: string | null;
  /** 번호를 남긴 경우에만 값이 있다 */
  phone: string | null;
  onDone: () => void;
}) {
  const [left, setLeft] = useState(PRINT_SECONDS);

  useEffect(() => {
    if (left <= 0) {
      onDone();
      return;
    }
    const t = setTimeout(() => setLeft((l) => l - 1), 1000);
    return () => clearTimeout(t);
  }, [left, onDone]);

  const progress = (PRINT_SECONDS - left) / PRINT_SECONDS;

  return (
    <Screen tone="mint">
      <TopRule label="인화 중" right={<span className="text-lg font-semibold">기기를 만지지 마세요</span>} />

      <div className="mt-12 grid flex-1 grid-cols-[1fr_auto] items-center gap-12">
        <div>
          <p className="text-2xl font-bold">프린터에서 사진이 나오고 있습니다</p>
          <p className="headline mt-4 text-[13rem] leading-[0.8]">
            {left}
            <span className="text-6xl">초</span>
          </p>

          <div className="bg-ink/20 mt-10 h-3 w-full">
            <div
              className="bg-ink h-full"
              style={{ width: `${progress * 100}%`, transition: "width 1s linear" }}
            />
          </div>

          {phone && (
            <p className="mt-8 text-xl font-semibold">
              원본 사진은 잠시 뒤 {phone} 으로 보내드립니다
            </p>
          )}
        </div>

        {frame && (
          <div
            className="border-ink/30 shrink-0 overflow-hidden border"
            style={{ width: 200, aspectRatio: PAGE_RATIO }}
          >
            {/* 캔버스로 만든 결과물이라 next/image 대신 원본을 그대로 쓴다 */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={frame}
              alt="인화 중인 사진"
              className="h-full w-full object-cover"
            />
          </div>
        )}
      </div>
    </Screen>
  );
}
