"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Screen, TopRule } from "./screen";
import { BigButton } from "@/components/ui/big-button";
import { PAGE_RATIO, PRINT_SECONDS } from "@/lib/frame";
import { uploadFrame } from "@/lib/upload";

type Sending = "sending" | "done" | "failed";

/**
 * 인화 대기 화면.
 *
 * 기다리는 동안 볼 게 없으면 시간이 두 배로 느껴진다. 그래서 남은 초를
 * 화면에서 가장 큰 것으로 두고, 무엇이 나오고 있는지도 같이 보여준다.
 *
 * 완성본을 노트북 서버로 올리는 것도 여기서 한다 — 어차피 기다리는 자리라
 * 사용자가 추가로 기다릴 일이 없고, 실패하면 화면에서 바로 다시 시도할 수 있다.
 *
 * ⚠️ 인쇄 요청은 아직 없다. 서버(LifeFivePhoto/server)도 저장까지만 하고
 *    출력은 안 한다. 프린터 연결이 정해지면 여기서 함께 부른다.
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
  // 번호가 없으면 애초에 보낼 수 없다 (명세상 phone 필수). 처음부터 끝난 상태로 둔다.
  const [sending, setSending] = useState<Sending>(phone ? "sending" : "done");
  const [sendError, setSendError] = useState("");
  /** 같은 사진을 두 번 올리지 않도록 — 서버가 사본을 _2 로 쌓는다 */
  const sentRef = useRef(false);

  // 첫 줄이 await 인 게 중요하다. 여기서 상태를 먼저 바꾸면
  // effect 본문에서 상태를 바꾸는 꼴이 되어 렌더가 연쇄로 돈다.
  const send = useCallback(async () => {
    if (!frame || !phone) return;
    const result = await uploadFrame(frame, phone);
    if (result.ok) {
      setSending("done");
    } else {
      setSending("failed");
      setSendError(result.error);
    }
  }, [frame, phone]);

  const retry = useCallback(() => {
    setSending("sending");
    setSendError("");
    void send();
  }, [send]);

  // 화면에 들어오면 한 번만 보낸다
  useEffect(() => {
    if (sentRef.current || !phone || !frame) return;
    sentRef.current = true;
    void send();
  }, [phone, frame, send]);

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
      <TopRule
        label="인화 중"
        right={<span className="text-lg font-semibold">기기를 만지지 마세요</span>}
      />

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
            <div className="mt-8">
              {sending === "sending" && (
                <p className="text-xl font-semibold text-ink/70">
                  사진을 서버로 보내는 중…
                </p>
              )}
              {sending === "done" && (
                <p className="text-xl font-semibold">
                  원본 사진은 잠시 뒤 {phone} 으로 보내드립니다
                </p>
              )}
              {sending === "failed" && (
                <div className="bg-ink text-paper max-w-xl p-5">
                  <p className="text-xl font-bold">사진을 서버에 보내지 못했습니다</p>
                  <p className="text-paper/70 mt-1 text-lg">{sendError}</p>
                  <p className="text-paper/70 mt-1 text-lg">
                    인화는 그대로 진행됩니다. 운영자를 불러주세요.
                  </p>
                  <BigButton
                    variant="line"
                    onDark
                    className="mt-4"
                    onClick={retry}
                  >
                    다시 보내기
                  </BigButton>
                </div>
              )}
            </div>
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
