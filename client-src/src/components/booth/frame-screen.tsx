"use client";

import { useEffect, useState } from "react";
import { Screen, TopRule } from "./screen";
import { BigButton } from "@/components/ui/big-button";
import { composeFrame } from "@/lib/compose";
import { FRAMES, type Frame } from "@/lib/frames";
import { PAGE, PRINT_TRIM } from "@/lib/frame";

/**
 * 종이에 남을 만큼만 보여준다.
 *
 * 인화하면 가장자리가 잘려나간다. 화면에 캔버스를 통째로 보여주면 고를 때는
 * 있던 것이 종이에는 없다. 그래서 잘릴 만큼(PRINT_TRIM)을 빼고 보여준다.
 *
 * 프레임마다 다르게 자르지 않는다. 잘리는 양은 인화기가 정하는 것이지
 * 그림이 정하는 게 아니다. 예전에 그림의 흰 테 두께로 잘랐더니 프레임마다
 * 네 변이 제각각이라 한쪽만 잘린 것처럼 보였다.
 */
const SHOWN = {
  w: PAGE.w - PRINT_TRIM.x * 2,
  h: PAGE.h - PRINT_TRIM.y * 2,
};

const SHOWN_RATIO = SHOWN.w / SHOWN.h;

/**
 * 상자는 남을 만큼의 크기가 되고, 그림은 원래 크기 그대로 두되 잘릴 만큼
 * 왼쪽·위로 민다. 넘치는 부분은 상자가 숨긴다. 잘라낸 그림을 따로 만들지
 * 않으므로 합성과 저장에는 아무 영향이 없다.
 */
const SHOWN_STYLE: React.CSSProperties = {
  display: "block",
  width: `${(PAGE.w / SHOWN.w) * 100}%`,
  height: `${(PAGE.h / SHOWN.h) * 100}%`,
  marginLeft: `${(-PRINT_TRIM.x / SHOWN.w) * 100}%`,
  marginTop: `${(-PRINT_TRIM.y / SHOWN.h) * 100}%`,
};

/**
 * 프레임 고르기.
 *
 * 프레임 이름만 늘어놓고 고르게 하면 뭐가 다른지 알 수 없다.
 * 그래서 **고른 사진이 실제로 들어간 모습**을 그려서 보여준다.
 * 여기 보이는 그림이 그대로 인화된다.
 *
 * 다섯 장을 다 그려야 하므로 프레임 수만큼 합성이 돈다. 두 장이면 금방이지만
 * 프레임이 늘어나면 느려질 수 있다. 그때는 한 칸짜리 견본으로 바꾸면 된다.
 */
export function FrameScreen({
  shots,
  onBack,
  onConfirm,
}: {
  shots: string[];
  onBack: () => void;
  onConfirm: (frame: Frame, composed: string) => void;
}) {
  const [previews, setPreviews] = useState<Record<string, string>>({});
  const [picked, setPicked] = useState<string>(FRAMES[0].id);
  const [error, setError] = useState("");

  useEffect(() => {
    let alive = true;

    (async () => {
      for (const frame of FRAMES) {
        try {
          const url = await composeFrame(shots, frame);
          if (!alive) return;
          setPreviews((prev) => ({ ...prev, [frame.id]: url }));
        } catch (e) {
          if (!alive) return;
          setError(e instanceof Error ? e.message : String(e));
          return;
        }
      }
    })();

    return () => {
      alive = false;
    };
  }, [shots]);

  const chosen = FRAMES.find((f) => f.id === picked) ?? FRAMES[0];
  const ready = Boolean(previews[chosen.id]);

  return (
    <Screen>
      <TopRule
        label="프레임"
        right={<span className="text-lg font-semibold">{FRAMES.length}가지</span>}
      />

      <h1 className="headline mt-8 text-7xl">어떤 프레임으로 할까요</h1>

      <div className="frames mt-8 flex min-h-0 flex-1 justify-center gap-8">
        {FRAMES.map((frame) => {
          const url = previews[frame.id];
          const on = frame.id === picked;

          return (
            <button
              key={frame.id}
              type="button"
              onClick={() => setPicked(frame.id)}
              className="flex min-h-0 min-w-0 flex-1 flex-col items-center"
            >
              {/* 이름을 붙이지 않는다. 그림을 보고 고르는 것이지 "민트"·"네온"
                  이라는 말을 보고 고르는 게 아니다. 고른 것은 테두리로 알린다 —
                  크기를 키우면 여러 장이 나란히 있을 때 줄이 흔들린다. */}
              <div
                className="frame-shot relative overflow-hidden bg-black"
                style={{
                  aspectRatio: SHOWN_RATIO,
                  outline: on ? "6px solid var(--color-ink)" : "1px solid rgba(10,10,10,0.2)",
                }}
              >
                {url ? (
                  // 방금 캔버스로 만든 결과물이라 next/image 대신 원본을 그대로 쓴다.
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={url} alt={`${frame.name} 프레임`} style={SHOWN_STYLE} />
                ) : (
                  <div className="text-paper/50 grid h-full place-items-center px-6 text-center text-lg">
                    {error ? error : "만드는 중"}
                  </div>
                )}
              </div>
            </button>
          );
        })}
      </div>

      <div className="mt-8 flex items-center gap-4">
        <BigButton variant="line" onClick={onBack}>
          다시 고르기
        </BigButton>
        <BigButton
          className="flex-1"
          disabled={!ready}
          onClick={() => {
            const url = previews[chosen.id];
            if (url) onConfirm(chosen, url);
          }}
        >
          이 프레임으로
        </BigButton>
      </div>
    </Screen>
  );
}
