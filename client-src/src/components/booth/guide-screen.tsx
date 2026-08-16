"use client";

import { Screen, TopRule } from "./screen";
import { BigButton } from "@/components/ui/big-button";
import { PICK_COUNT, SHOOT_INTERVAL, SHOT_COUNT } from "@/lib/frame";
import type { CameraState } from "@/hooks/use-camera";

/**
 * 안내 화면. 이 화면이 떠 있는 동안 뒤에서 카메라를 미리 켜둔다 —
 * 그래서 촬영 화면으로 넘어가면 기다리는 시간이 없다.
 *
 * 번호도 아이콘도 붙이지 않았다. 위에서 아래로 놓인 순서가 곧 차례라서,
 * 번호를 또 다는 건 같은 말을 두 번 하는 것이다.
 */
export function GuideScreen({
  cameraState,
  cameraError,
  onNext,
  onCancel,
  onRetryCamera,
}: {
  cameraState: CameraState;
  cameraError: string;
  onNext: () => void;
  onCancel: () => void;
  onRetryCamera: () => void;
}) {
  const steps = [
    {
      title: "찍기",
      lead: `${SHOT_COUNT}장이 자동으로 찍힙니다`,
      body: `${SHOOT_INTERVAL}초에 한 번씩 저절로 찍혀요. 버튼을 누를 필요 없습니다.`,
    },
    {
      title: "고르기",
      lead: `그중 ${PICK_COUNT}장을 고릅니다`,
      body: "고른 순서대로 프레임에 들어갑니다. 마음에 안 들면 다시 찍어도 됩니다.",
    },
    {
      title: "가져가기",
      lead: "인화해서 바로 가져갑니다",
      // 인쇄는 노트북에서 사람이 뽑는다. 몇 초 걸린다고 못 박으면 지킬 수 없다.
      body: "운영자가 인화해서 전달해드립니다. 원본 사진은 휴대폰으로도 보내드려요.",
    },
  ];

  const failed = cameraState === "error";

  return (
    <Screen>
      <TopRule label="안내" />

      <h1 className="headline mt-8 text-8xl">이렇게 합니다</h1>

      <div className="mt-12 flex-1">
        {steps.map((s) => (
          <div
            key={s.title}
            className="border-ink/20 grid grid-cols-[13rem_1fr] gap-8 border-t py-8"
          >
            {/* "가져가기"는 4글자라 48px × 4 = 192px. 칸을 10rem(160px)로 두면 두 줄로 접힌다. */}
            <p className="headline text-mint text-5xl whitespace-nowrap">{s.title}</p>
            <div>
              <p className="text-3xl leading-tight font-bold">{s.lead}</p>
              <p className="text-ink-60 mt-2 max-w-xl text-xl leading-relaxed">
                {s.body}
              </p>
            </div>
          </div>
        ))}
        <div className="border-ink/20 border-t" />
      </div>

      {/* 카메라가 안 열리면 이 뒤로는 아무것도 안 되니 여기서 잡는다.
          잘 되고 있을 땐 아무 말도 하지 않는다. */}
      {failed && (
        <div className="bg-ink text-paper mt-6 p-7">
          <p className="text-3xl font-bold">카메라를 열 수 없습니다</p>
          <p className="text-paper/70 mt-2 text-xl">
            운영자를 불러주세요. 주소가 https 가 아니거나 카메라 권한이 거부된
            상태일 수 있습니다.
          </p>
          {/* 40% 는 대비 3.5라 못 읽는다. 오류 원문은 운영자가 봐야 하는 정보다. */}
          <p className="text-paper/70 mt-2 font-mono text-sm break-all">{cameraError}</p>
          <BigButton variant="line" onDark className="mt-5" onClick={onRetryCamera}>
            다시 시도
          </BigButton>
        </div>
      )}

      <div className="mt-8 flex items-center gap-4">
        <BigButton variant="plain" onClick={onCancel}>
          그만두기
        </BigButton>
        <BigButton className="flex-1" onClick={onNext} disabled={failed}>
          촬영 시작
        </BigButton>
      </div>
    </Screen>
  );
}
