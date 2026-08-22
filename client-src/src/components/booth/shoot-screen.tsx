"use client";

import { useCallback, useEffect, useRef, useState } from "react";
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
  const { attachVideo, state, grab, start } = camera;

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

  /**
   * 영상이 멈췄는지 지켜본다.
   *
   * 아이패드에서 홈으로 나갔다 오거나 화면이 잠기면 카메라가 끊긴다. 그때
   * <video> 는 마지막 장면을 그대로 물고 있어 겉으로는 멀쩡한데 grab() 은
   * 아무것도 못 집는다. 카운트다운은 찍지도 못하고 되돌지도 못해 그 자리에
   * 서고, 손님은 몇 장 찍다 만 화면을 보며 하염없이 기다리게 된다.
   *
   * 이벤트로 잡으려 했지만 믿을 수 없었다. 트랙을 스스로 끄면 ended 가 아예
   * 안 오고, iOS 가 뒤로 보낼 때는 mute 만 오기도 한다. 그래서 어느 쪽이든
   * 결과로 드러나는 것 하나만 본다 — 재생 시각이 더 이상 흐르지 않는지.
   */
  const [stalled, setStalled] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  const holdVideo = useCallback(
    (el: HTMLVideoElement | null) => {
      videoRef.current = el;
      attachVideo(el);
    },
    [attachVideo],
  );

  useEffect(() => {
    if (done) return;
    let last = -1;
    let still = 0;
    const t = setInterval(() => {
      const v = videoRef.current;
      if (!v || !v.srcObject) return;
      const now = v.currentTime;
      // 세 번 연달아 제자리면 멈춘 것으로 본다. 한 번은 버벅임일 수 있다.
      still = now === last ? still + 1 : 0;
      last = now;
      setStalled(still >= 3);
    }, 1000);
    return () => clearInterval(t);
  }, [done]);

  const lost = state === "error" || stalled;
  /** 영상이 실제로 흐르는 중인가. 끊긴 뒤의 멈춘 화면은 여기서 걸러진다 */
  const running = live && !lost;

  const restart = useCallback(() => {
    setStalled(false);
    void start();
  }, [start]);

  // 카운트다운. 마지막 1초가 지나는 순간 찍고 다시 SHOOT_INTERVAL 로 되돌린다.
  // 찍는 동작을 타이머 콜백 안에서 하는 게 중요하다 — effect 본문에서 바로 상태를
  // 바꾸면 렌더가 연쇄로 돈다.
  useEffect(() => {
    if (done || !running) return;
    const t = setTimeout(() => {
      if (remain <= 1) shoot();
      else setRemain((r) => r - 1);
    }, 1000);
    return () => clearTimeout(t);
  }, [remain, done, running, shoot]);

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

        {!done && running && (
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

      {/* 머리글·필름·버튼을 뺀 나머지 세로를 카메라가 모두 가져간다.
          방향마다 높이를 숫자로 정해두면 기기가 바뀔 때마다 다시 맞춰야 한다. */}
      <div className="mt-5 flex min-h-0 flex-1 flex-col">
        {/* 남은 시간이 줄어드는 막대. 영상 바로 위에 붙어 있어 곁눈으로 보인다. */}
        <div className="bg-paper/15 h-2 w-full shrink-0">
          <div
            className="bg-mint h-full"
            style={{
              width: `${(remain / SHOOT_INTERVAL) * 100}%`,
              transition: "width 1s linear",
            }}
          />
        </div>

        {/*
          높이로 크기를 정하고 너비는 비율이 따라오게 한다.
          w-full 로 너비를 먼저 정하면 상자가 컷보다 납작해진다. 그러면 화면에
          보이는 범위와 실제로 찍히는 범위가 어긋나서, 자세를 맞춰도 좌우가
          잘려 나간다. grab() 이 CUT_RATIO 로 잘라내기 때문이다.
        */}
        <div className="flex min-h-0 flex-1 justify-center">
          <div
            className="relative h-full overflow-hidden bg-black"
            style={{ aspectRatio: CUT_RATIO, maxWidth: "100%" }}
          >
          <video
            ref={holdVideo}
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

          {!running && (
            <div className="absolute inset-0 grid place-items-center bg-black/80 px-8 text-center">
              {lost ? (
                <div>
                  <p className="headline text-paper text-4xl">카메라가 꺼졌습니다</p>
                  <p className="text-paper/60 mt-3 text-xl">
                    찍은 {shots.length}장은 그대로 있습니다
                  </p>
                  <button
                    type="button"
                    onClick={restart}
                    className="bg-mint text-ink mt-6 px-8 py-4 text-2xl font-bold"
                  >
                    카메라 다시 켜기
                  </button>
                </div>
              ) : (
                <p className="text-paper/50 text-2xl">카메라 준비 중</p>
              )}
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
      </div>

      {/* 찍은 컷 — 가로에서는 카메라에 자리를 내주려고 더 작게 줄인다 */}
      <div className="film mt-5 grid grid-cols-8 gap-1.5">
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

      <div className="mt-5">
        <BigButton
          variant="line"
          onDark
          wide
          onClick={shoot}
          disabled={done || !running}
        >
          기다리지 않고 지금 찍기
        </BigButton>
      </div>
    </Screen>
  );
}
