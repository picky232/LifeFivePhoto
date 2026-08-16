"use client";

import { useCallback, useEffect, useRef } from "react";

type Sentinel = { release: () => Promise<void>; released: boolean };
type WakeLockNavigator = Navigator & {
  wakeLock?: { request: (type: "screen") => Promise<Sentinel> };
};

/**
 * 화면이 저절로 꺼지지 않게 붙잡는다.
 *
 * 행사 내내 켜둬야 하는 부스라 필요하다. 사파리 16.4 이상에서만 되고,
 * 안 되는 기기에서는 조용히 넘어간다 — 그때는 아이패드 설정에서
 * 자동 잠금을 "안 함"으로 두는 게 진짜 해결책이다.
 *
 * 브라우저가 탭을 숨기면 잠금이 저절로 풀리므로, 돌아왔을 때 다시 건다.
 */
export function useWakeLock() {
  const sentinel = useRef<Sentinel | null>(null);
  const wanted = useRef(false);

  const acquire = useCallback(async () => {
    wanted.current = true;
    const nav = navigator as WakeLockNavigator;
    if (!nav.wakeLock) return;
    if (sentinel.current && !sentinel.current.released) return;
    try {
      sentinel.current = await nav.wakeLock.request("screen");
    } catch {
      // 사용자가 거부했거나 배터리 절약 모드다 — 부스가 멈출 이유는 아니다
    }
  }, []);

  const release = useCallback(() => {
    wanted.current = false;
    void sentinel.current?.release();
    sentinel.current = null;
  }, []);

  // 화면을 다시 켜거나 탭으로 돌아오면 잠금이 풀려 있으므로 다시 건다
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === "visible" && wanted.current) void acquire();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [acquire]);

  useEffect(() => release, [release]);

  return { acquire, release };
}
