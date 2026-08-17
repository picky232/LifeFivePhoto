"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Screen, TopRule } from "./screen";
import { BigButton } from "@/components/ui/big-button";
import { PAGE_RATIO, REQUEST_DONE_SECONDS } from "@/lib/frame";
import { uploadFrame } from "@/lib/upload";

type Sending = "sending" | "done" | "failed";

/**
 * 인쇄 요청 화면.
 *
 * 인쇄는 노트북에서 사람이 직접 뽑는다. 앱이 하는 일은 완성본을 서버로
 * 올려서 뽑을 수 있게 만드는 것까지다.
 *
 * 그래서 예전처럼 초를 세지 않는다. 몇 초 뒤에 나올지 앱은 모르고,
 * 모르는 걸 세는 숫자는 지킬 수 없는 약속이다. 대신 전송이 어디까지 갔는지만
 * 정확히 보여준다 — 보내는 중인지, 요청이 들어갔는지, 실패했는지.
 */
export function PrintingScreen({
  frame,
  phone,
  onDone,
}: {
  /** 인쇄로 보내는 그 그림 */
  frame: string | null;
  phone: string;
  onDone: () => void;
}) {
  const [sending, setSending] = useState<Sending>("sending");
  const [sendError, setSendError] = useState("");
  const [left, setLeft] = useState(REQUEST_DONE_SECONDS);
  /** 같은 사진을 두 번 올리지 않도록 — 서버가 사본을 _2 로 쌓는다 */
  const sentRef = useRef(false);

  // 첫 줄이 await 인 게 중요하다. 여기서 상태를 먼저 바꾸면
  // effect 본문에서 상태를 바꾸는 꼴이 되어 렌더가 연쇄로 돈다.
  const send = useCallback(async () => {
    if (!frame) return;
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

  useEffect(() => {
    if (sentRef.current || !frame) return;
    sentRef.current = true;
    void send();
  }, [frame, send]);

  // 요청이 들어간 뒤에만 완료 화면으로 넘어간다.
  // 실패했는데 넘어가면 학생은 사진이 나올 줄 알고 계속 기다리게 된다.
  useEffect(() => {
    if (sending !== "done") return;
    if (left <= 0) {
      onDone();
      return;
    }
    const t = setTimeout(() => setLeft((l) => l - 1), 1000);
    return () => clearTimeout(t);
  }, [sending, left, onDone]);

  return (
    <Screen tone="mint">
      <TopRule
        label="인쇄 요청"
        right={
          <span className="text-lg font-semibold">
            {sending === "done" ? "요청 완료" : "잠시만 기다려주세요"}
          </span>
        }
      />

      <div className="mt-12 grid flex-1 grid-cols-[1fr_auto] items-center gap-12">
        <div>
          {sending === "sending" && (
            <>
              <h1 className="headline text-8xl leading-[0.9]">
                사진을
                <br />
                보내는 중
              </h1>
              <p className="mt-6 text-2xl font-semibold">
                기기를 만지지 말아주세요
              </p>
            </>
          )}

          {sending === "done" && (
            <>
              <h1 className="headline text-8xl leading-[0.9]">
                인쇄를
                <br />
                요청했습니다
              </h1>
              <p className="mt-6 text-2xl font-semibold">
                운영자가 사진을 인화해 전달해드립니다
              </p>
              <BigButton className="mt-8" onClick={onDone}>
                확인 ({left})
              </BigButton>
            </>
          )}

          {sending === "failed" && (
            <>
              <h1 className="headline text-7xl leading-[0.9]">
                보내지
                <br />
                못했습니다
              </h1>
              <div className="bg-ink text-paper mt-6 max-w-xl p-6">
                <p className="text-xl font-bold">{sendError}</p>
                <p className="text-paper/70 mt-2 text-lg">
                  사진이 노트북에 저장되지 않아 인쇄할 수 없습니다.
                  운영자를 불러주세요.
                </p>
              </div>
              <div className="mt-6 flex items-center gap-4">
                <BigButton onClick={retry}>다시 보내기</BigButton>
                <BigButton variant="plain" onClick={onDone}>
                  그만두기
                </BigButton>
              </div>
            </>
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
              alt="인쇄를 요청한 사진"
              className="h-full w-full object-cover"
            />
          </div>
        )}
      </div>
    </Screen>
  );
}
