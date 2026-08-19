"use client";

import { useEffect, useState } from "react";
import { Screen, TopRule } from "./screen";
import { BigButton } from "@/components/ui/big-button";
import { composeFrame } from "@/lib/compose";
import { FRAMES, type Frame } from "@/lib/frames";
import { PAGE_RATIO } from "@/lib/frame";

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
              className="flex min-h-0 min-w-0 flex-1 flex-col items-center gap-3"
            >
              {/* 고른 것은 테두리로 표시한다. 크기를 키우면 두 개가 나란히
                  있을 때 줄이 흔들려서 오히려 고르기 어렵다. */}
              <div
                className="frame-shot relative overflow-hidden bg-black"
                style={{
                  aspectRatio: PAGE_RATIO,
                  outline: on ? "6px solid var(--color-ink)" : "1px solid rgba(10,10,10,0.2)",
                  outlineOffset: on ? "0" : "0",
                }}
              >
                {url ? (
                  // 방금 캔버스로 만든 결과물이라 next/image 대신 원본을 그대로 쓴다
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={url} alt={`${frame.name} 프레임`} className="h-full w-full object-contain" />
                ) : (
                  <div className="text-paper/50 grid h-full place-items-center px-6 text-center text-lg">
                    {error ? error : "만드는 중"}
                  </div>
                )}
              </div>

              <div className="text-center">
                <p className={`text-2xl font-bold ${on ? "text-ink" : "text-ink-60"}`}>
                  {frame.name}
                </p>
                <p className="text-ink-60 mt-0.5 text-base">{frame.note}</p>
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
