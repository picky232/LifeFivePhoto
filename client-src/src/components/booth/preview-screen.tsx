"use client";

import { Screen, TopRule } from "./screen";
import { BigButton } from "@/components/ui/big-button";
import { PAGE_INCH, PAGE_RATIO } from "@/lib/frame";

/**
 * 완성된 프레임 미리보기.
 *
 * 여기 보이는 그림이 인쇄로 보내는 그림 그 자체다 (같은 dataURL).
 * 미리보기용을 따로 만들지 않는 이유 — 둘이 갈라지면 "보인 것과 다르게 나온다".
 *
 * 합성은 앞 단계(프레임 고르기)에서 이미 끝났다. 여기서 다시 만들면 같은 일을
 * 두 번 하고, 그사이 화면이 비어 보인다.
 *
 * 종이색 바탕에 프레임을 올린다. 실제로 책상 위에 인화물을 놓고
 * 들여다보는 상황과 같아서, 인쇄 결과를 가장 정직하게 가늠할 수 있다.
 */
export function PreviewScreen({
  composed,
  frameName,
  onBack,
  onConfirm,
}: {
  /** 프레임 고르기에서 만들어 넘겨준 완성본 */
  composed: string | null;
  frameName: string;
  onBack: () => void;
  onConfirm: () => void;
}) {
  return (
    <Screen>
      <TopRule
        label="완성"
        right={
          <span className="text-lg font-semibold">
            {frameName} &middot; {PAGE_INCH.w} × {PAGE_INCH.h} 인치
          </span>
        }
      />

      <h1 className="headline mt-8 text-7xl">이렇게 나옵니다</h1>

      <div className="flex min-h-0 flex-1 items-center justify-center py-6">
        <div
          className="border-ink/25 relative overflow-hidden border bg-black"
          style={{ aspectRatio: PAGE_RATIO, maxHeight: "100%", maxWidth: "100%" }}
        >
          {composed ? (
            // 앞 단계에서 캔버스로 만든 결과물이라 next/image 대신 원본을 그대로 쓴다
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={composed}
              alt="완성된 분경5컷"
              className="h-full w-full object-contain"
            />
          ) : (
            <div className="text-paper/50 grid h-full place-items-center px-8 text-center text-xl">
              사진을 붙이는 중
            </div>
          )}
        </div>
      </div>

      <div className="flex items-center gap-4">
        <BigButton variant="line" onClick={onBack}>
          프레임 다시
        </BigButton>
        <BigButton className="flex-1" disabled={!composed} onClick={onConfirm}>
          선택 완료
        </BigButton>
      </div>
    </Screen>
  );
}
