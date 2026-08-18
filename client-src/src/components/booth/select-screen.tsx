"use client";

import { useCallback, useState } from "react";
import { Screen, TopRule } from "./screen";
import { BigButton } from "@/components/ui/big-button";
import { CUT_RATIO, PICK_COUNT } from "@/lib/frame";
import { DEPARTMENTS } from "@/lib/departments";

/**
 * 8장 중 5장 고르기.
 *
 * 고른 **순서**가 프레임의 칸 순서이자 학과 순서다.
 * 그래서 몇 번째로 골랐는지와 어느 학과 칸에 들어가는지를 같이 보여준다.
 * 학과 색이 처음 등장하는 자리가 여기다 — 색이 뜻을 갖는 유일한 화면이라서.
 */
export function SelectScreen({
  shots,
  onDone,
  onRetake,
}: {
  shots: string[];
  onDone: (picked: string[]) => void;
  onRetake: () => void;
}) {
  /** 고른 사진의 인덱스. 배열 순서가 곧 프레임 칸 순서다. */
  const [picked, setPicked] = useState<number[]>([]);
  const [nudge, setNudge] = useState(false);

  const full = picked.length >= PICK_COUNT;

  const toggle = useCallback((i: number) => {
    setPicked((prev) => {
      if (prev.includes(i)) return prev.filter((p) => p !== i);
      if (prev.length >= PICK_COUNT) {
        setNudge(true);
        setTimeout(() => setNudge(false), 1800);
        return prev;
      }
      return [...prev, i];
    });
  }, []);

  return (
    <Screen tone="dark">
      <TopRule
        onDark
        label="고르기"
        right={
          <span className="headline text-3xl">
            {picked.length}
            <span className="text-paper/55"> / {PICK_COUNT}</span>
          </span>
        }
      />

      <div className="mt-6 flex items-end justify-between gap-8">
        <h1 className="headline text-6xl">마음에 드는 {PICK_COUNT}장</h1>

        {/* 다섯 칸이 학과 색으로 차오른다. 이 순서가 프레임 순서다. */}
        <div className="flex shrink-0 gap-1.5 pb-2">
          {DEPARTMENTS.map((d, i) => (
            <span
              key={d.id}
              className="h-4 w-14"
              style={{
                background:
                  i < picked.length ? d.accent : "rgba(242,240,233,0.14)",
              }}
            />
          ))}
        </div>
      </div>

      <div className="picks mt-7 grid grid-cols-4 gap-3">
        {shots.map((shot, i) => {
          const order = picked.indexOf(i);
          const isPicked = order >= 0;
          const dept = isPicked ? DEPARTMENTS[order] : null;

          return (
            <button
              key={i}
              type="button"
              onClick={() => toggle(i)}
              className="flex min-h-0 flex-col text-left"
            >
              <div
                className="pick-photo relative overflow-hidden"
                style={{
                  aspectRatio: CUT_RATIO,
                  outline: isPicked ? `4px solid ${dept?.accent}` : "none",
                  outlineOffset: "-4px",
                }}
              >
                {/* 방금 찍은 사진이라 next/image 대신 원본을 그대로 쓴다 */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={shot}
                  alt={`${i + 1}번째 사진`}
                  className="h-full w-full object-cover"
                  style={{ opacity: isPicked ? 1 : 0.42 }}
                />

                {isPicked && (
                  <span
                    className="text-ink headline absolute top-0 left-0 grid h-12 w-12 place-items-center text-3xl"
                    style={{ background: dept?.accent }}
                  >
                    {order + 1}
                  </span>
                )}
              </div>

              {/* 이 사진이 어느 학과 칸에 들어가는지.
                  안 고른 사진에는 아무 말도 쓰지 않는다 — 8칸에 "고르지 않음"이
                  깔리면 정보 없이 시끄럽기만 하다. 자리는 비워둬야 안 흔들린다. */}
              <p
                className="mt-2 h-6 text-base font-bold"
                style={{ color: dept?.accent }}
              >
                {dept?.name ?? " "}
              </p>
            </button>
          );
        })}
      </div>

      {/* 가로에서는 사진 격자가 남는 세로를 가져가므로 이 채우개를 접는다 */}
      <div className="spacer flex-1" />

      {nudge && (
        <p className="bg-mint text-ink mt-6 px-6 py-4 text-xl font-bold">
          {PICK_COUNT}장을 다 골랐어요. 바꾸려면 골랐던 사진을 한 번 더 누르세요.
        </p>
      )}

      <div className="mt-6 flex items-center gap-4">
        <BigButton variant="plain" onDark onClick={onRetake}>
          다시 찍기
        </BigButton>
        <BigButton
          onDark
          className="flex-1"
          disabled={!full}
          onClick={() => onDone(picked.map((i) => shots[i]))}
        >
          {full ? "이 사진으로 만들기" : `${PICK_COUNT - picked.length}장 더 골라주세요`}
        </BigButton>
      </div>
    </Screen>
  );
}
