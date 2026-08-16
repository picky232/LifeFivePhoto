"use client";

import { useCallback, useEffect, useState } from "react";
import { Screen, TopRule } from "./screen";
import { BigButton } from "@/components/ui/big-button";
import { CUT_RATIO, SHOOT_INTERVAL, SHOT_COUNT } from "@/lib/frame";
import type { useCamera } from "@/hooks/use-camera";

type Camera = ReturnType<typeof useCamera>;

/**
 * 촬영 화면. SHOOT_INTERVAL 초마다 저절로 한 장씩, 총 SHOT_COUNT 장.
 *
 * 미리보기 박스를 컷과 같은 비율(CUT_RATIO)로 잘라 보여준다.
 * 그래야 화면에서 잘려 보이는 부분이 결과물에서도 잘린다 — 구도가 어긋나지 않는다.
 *
 * ★ 카운트다운 숫자를 영상 한가운데에 얹지 않았다.
 *   거기 있으면 정작 자기 얼굴을 가린다. 숫자는 영상 위쪽 띠에 두고,
 *   영상에는 줄어드는 막대만 걸쳐서 남은 시간이 곁눈으로 보이게 했다.
 */
export function ShootScreen({
  camera,
  onDone,
  onCancel,
}: {
  camera: Camera;
  onDone: (shots: string[]) => void;
  onCancel: () => void;
}) {
  const { attachVideo, state, grab } = camera;

  const [shots, setShots] = useState<string[]>([]);
  const [remain, setRemain] = useState(SHOOT_INTERVAL);
  /** 값이 바뀔 때마다 번쩍임 애니메이션을 다시 태우기 위한 키 */
  const [flashKey, setFlashKey] = useState(0);
  /**
   * 영상이 실제로 나오고 있는지. 카메라 상태가 "ready" 라도 화면에 안 붙어
   * 있을 수 있으므로, 카운트다운은 이 값을 보고 돈다 — 빈 화면에 8장을
   * 날리는 일을 막는 장치다.
   */
  const [live, setLive] = useState(false);

  const done = shots.length >= SHOT_COUNT;

  const shoot = useCallback(() => {
    const shot = grab();
    if (!shot) return;
    setShots((prev) => [...prev, shot]);
    setFlashKey((k) => k + 1);
    setRemain(SHOOT_INTERVAL);
  }, [grab]);

  // 카운트다운. 마지막 1초가 지나는 순간 찍고 다시 SHOOT_INTERVAL 로 되돌린다.
  // 찍는 동작을 타이머 콜백 안에서 하는 게 중요하다 — effect 본문에서 바로 상태를
  // 바꾸면 렌더가 연쇄로 돈다.
  useEffect(() => {
    if (done || !live) return;
    const t = setTimeout(() => {
      if (remain <= 1) shoot();
      else setRemain((r) => r - 1);
    }, 1000);
    return () => clearTimeout(t);
  }, [remain, done, live, shoot]);

  // 마지막 번쩍임을 보여준 뒤 넘어간다
  useEffect(() => {
    if (!done) return;
    const t = setTimeout(() => onDone(shots), 900);
    return () => clearTimeout(t);
  }, [done, shots, onDone]);

  return (
    <Screen tone="dark">
      <TopRule
        onDark
        label="촬영 중"
        right={
          // 여기에 큰 버튼(최소 높이 80px)을 넣으면 머리글이 그만큼 벌어져
          // 아래 영상·필름·버튼이 세로로 넘친다. 그래서 이 자리만 작게 쓴다.
          <button
            type="button"
            onClick={onCancel}
            className="text-paper/55 px-3 py-1 text-xl font-semibold"
          >
            그만두기
          </button>
        }
      />

      {/* 몇 번째인지 · 몇 초 남았는지 — 영상 밖에 둔다 */}
      <div className="mt-5 flex items-end justify-between">
        <p className="headline text-6xl">
          {Math.min(shots.length + 1, SHOT_COUNT)}
          {/* 30% 는 대비 2.5라 안 읽힌다. 몇 장 중 몇 장인지는 정보다. */}
          <span className="text-paper/55"> / {SHOT_COUNT}</span>
        </p>

        {!done && live && (
          <div className="flex items-end gap-4">
            <span className="text-paper/50 pb-2 text-xl font-semibold">
              다음 컷까지
            </span>
            <span
              key={remain}
              className="animate-tick bg-mint text-ink headline grid h-24 w-24 place-items-center text-6xl"
            >
              {remain}
            </span>
          </div>
        )}
      </div>

      <div className="mt-5">
        {/* 남은 시간이 줄어드는 막대. 영상 바로 위에 붙어 있어 곁눈으로 보인다. */}
        <div className="bg-paper/15 h-2 w-full">
          <div
            className="bg-mint h-full"
            style={{
              width: `${(remain / SHOOT_INTERVAL) * 100}%`,
              transition: "width 1s linear",
            }}
          />
        </div>

        <div
          className="relative w-full overflow-hidden bg-black"
          style={{ aspectRatio: CUT_RATIO, maxHeight: "52vh" }}
        >
          <video
            ref={attachVideo}
            playsInline
            muted
            autoPlay
            // 둘 중 먼저 오는 쪽으로 "영상이 나온다"를 판정한다.
            // loadedmetadata 는 크기를 알게 된 시점이라 grab() 이 가능해지는 순간이기도 하다.
            onLoadedMetadata={() => setLive(true)}
            onPlaying={() => setLive(true)}
            className="h-full w-full object-cover"
            // 셀카는 거울처럼 보여야 자연스럽다. 저장할 때 되돌린다.
            style={{ transform: "scaleX(-1)" }}
          />

          {!live && (
            <div className="text-paper/50 absolute inset-0 grid place-items-center px-8 text-center text-2xl">
              {state === "error" ? "카메라를 열 수 없습니다" : "카메라 준비 중"}
            </div>
          )}

          {/* 찰칵 */}
          {flashKey > 0 && (
            <div
              key={flashKey}
              className="animate-flash pointer-events-none absolute inset-0 bg-white"
            />
          )}

          {done && (
            <div className="bg-mint text-ink absolute inset-0 grid place-items-center">
              <p className="headline text-7xl">다 찍었어요</p>
            </div>
          )}
        </div>
      </div>

      {/* 찍은 컷 */}
      <div className="mt-5 grid grid-cols-8 gap-1.5">
        {Array.from({ length: SHOT_COUNT }, (_, i) => (
          <div
            key={i}
            className={
              shots[i] ? "overflow-hidden" : "border-paper/20 border border-dashed"
            }
            style={{ aspectRatio: CUT_RATIO }}
          >
            {shots[i] ? (
              // 방금 찍은 사진을 즉석에서 보여주는 거라 next/image 대신 원본을 그대로 쓴다
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={shots[i]}
                alt={`${i + 1}번째 사진`}
                className="h-full w-full object-cover"
              />
            ) : null}
          </div>
        ))}
      </div>

      <div className="flex-1" />

      <div className="mt-5">
        <BigButton
          variant="line"
          onDark
          wide
          onClick={shoot}
          disabled={done || !live}
        >
          기다리지 않고 지금 찍기
        </BigButton>
      </div>
    </Screen>
  );
}
