"use client";

import { useState } from "react";
import { Screen, TopRule } from "./screen";
import { BigButton } from "@/components/ui/big-button";
import { CONSENT_TEXT } from "@/lib/privacy";

/** 010-1234-5678 꼴로 보기 좋게 */
function format(d: string) {
  if (d.length <= 3) return d;
  if (d.length <= 7) return `${d.slice(0, 3)}-${d.slice(3)}`;
  if (d.length === 10) return `${d.slice(0, 3)}-${d.slice(3, 6)}-${d.slice(6)}`;
  return `${d.slice(0, 3)}-${d.slice(3, 7)}-${d.slice(7)}`;
}

const VALID = /^01[016789]\d{7,8}$/;

const KEYS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "clear", "0", "back"] as const;

/**
 * 휴대폰 번호 입력.
 *
 * 시스템 키보드를 쓰지 않는다 — 아이패드에서 키보드가 올라오면 전체화면
 * 레이아웃이 밀리고, 이모지·붙여넣기 같은 탈출 경로도 생긴다.
 * 그래서 숫자판을 직접 그렸다. input 요소도 쓰지 않는다.
 *
 * 키는 카드가 아니라 격자다. 검정 선으로 나눈 한 덩어리라서
 * 실제 번호판처럼 보이고, 칸 사이 여백을 세는 수고가 없다.
 */
export function PhoneScreen({
  onSubmit,
  onBack,
}: {
  onSubmit: (phone: string) => void;
  onBack: () => void;
}) {
  const [digits, setDigits] = useState("");
  const [agreed, setAgreed] = useState(false);

  const valid = VALID.test(digits);

  const press = (k: (typeof KEYS)[number]) => {
    if (k === "clear") return setDigits("");
    if (k === "back") return setDigits((d) => d.slice(0, -1));
    setDigits((d) => (d.length >= 11 ? d : d + k));
  };

  return (
    <Screen>
      <TopRule
        label="사진 받기"
        right={<span className="text-lg font-semibold">마지막 단계</span>}
      />

      <div className="mt-8 flex items-end justify-between gap-10">
        <div>
          <h1 className="headline text-7xl">번호를 눌러주세요</h1>
          <p className="text-ink-60 mt-3 max-w-xl text-xl leading-relaxed">
            번호로 사진을 찾기 때문에 인화에도 필요합니다.
          </p>
        </div>

        {/* 입력값 — 실제 input 이 아니라 그림이다 */}
        <p
          className={`headline border-ink shrink-0 border-b-4 pb-2 text-6xl ${
            // 20% 는 대비 1.56이라 자리표시가 안 보인다
            digits ? "text-ink" : "text-ink/35"
          }`}
        >
          {digits ? format(digits) : "010-0000-0000"}
        </p>
      </div>

      {/* 숫자판 — 칸 사이를 검정 선으로 나눈 하나의 격자 */}
      <div className="border-ink mx-auto mt-9 grid w-full max-w-2xl grid-cols-3 gap-px border bg-current">
        {KEYS.map((k) => {
          const isAction = k === "clear" || k === "back";
          return (
            <button
              key={k}
              type="button"
              onClick={() => press(k)}
              className={[
                "bg-paper active:bg-mint min-h-[92px] transition-colors duration-75",
                isAction ? "text-ink-60 text-lg font-bold" : "headline text-ink text-5xl",
              ].join(" ")}
            >
              {k === "clear" ? "전체 지우기" : k === "back" ? "한 자 지우기" : k}
            </button>
          );
        })}
      </div>

      <div className="flex-1" />

      {/* 동의 — 번호를 남길 때만 필요하다 */}
      <button
        type="button"
        onClick={() => setAgreed((a) => !a)}
        className="border-ink/20 mt-8 flex items-start gap-4 border-t border-b py-6 text-left"
      >
        <span
          className={`border-ink mt-0.5 grid h-8 w-8 shrink-0 place-items-center border-2 text-xl font-black ${
            agreed ? "bg-ink text-paper" : "text-transparent"
          }`}
        >
          ✓
        </span>
        <span className="text-ink-60 text-lg leading-relaxed">{CONSENT_TEXT}</span>
      </button>

      {/* 왜 못 누르는지는 버튼 밖에서 말한다.
          버튼 글자를 바꿔서 알리면 세 버튼이 가로를 넘기고, 읽히지도 않는다. */}
      <p className="text-ink-60 mt-5 h-7 text-lg">
        {!valid
          ? "번호를 끝까지 입력해주세요."
          : !agreed
            ? "위 안내를 눌러 동의해주세요."
            : ""}
      </p>

      <div className="mt-2 flex items-center gap-4">
        <BigButton variant="plain" onClick={onBack}>
          뒤로
        </BigButton>
        <BigButton
          className="flex-1"
          disabled={!valid || !agreed}
          onClick={() => onSubmit(digits)}
        >
          확인
        </BigButton>
      </div>
    </Screen>
  );
}
