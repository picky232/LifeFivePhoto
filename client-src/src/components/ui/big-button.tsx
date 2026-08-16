"use client";

import type { ReactNode } from "react";

/**
 * 부스 버튼.
 *
 * 납작하다. 그림자도 그러데이션도 없고, 모서리도 거의 각이다.
 * 누른 걸 알려주는 방법은 색이 뒤집히는 것 하나뿐 — 아이패드에는 hover 가 없고,
 * 크기가 변하면 손가락 아래에서 버튼이 도망간다.
 *
 * fill   — 이 화면에서 할 일. 화면당 하나만.
 * line   — 옆길. 테두리만.
 * plain  — 취소·뒤로. 글자만.
 */
type Variant = "fill" | "line" | "plain";

export function BigButton({
  children,
  onClick,
  variant = "fill",
  disabled = false,
  wide = false,
  onDark = false,
  className = "",
}: {
  children: ReactNode;
  onClick?: () => void;
  variant?: Variant;
  disabled?: boolean;
  wide?: boolean;
  /** 어두운 화면 위에 놓일 때 */
  onDark?: boolean;
  className?: string;
}) {
  const look: Record<Variant, string> = {
    fill: onDark
      ? "bg-mint text-ink active:bg-paper"
      : "bg-ink text-paper active:bg-mint active:text-ink",
    line: onDark
      ? "border-2 border-paper/35 text-paper active:bg-paper active:text-ink"
      : "border-2 border-ink text-ink active:bg-ink active:text-paper",
    plain: onDark ? "text-paper/55" : "text-ink-60",
  };

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={[
        "min-h-[80px] rounded-sm px-9 text-2xl font-bold whitespace-nowrap",
        "transition-colors duration-75",
        "disabled:pointer-events-none disabled:opacity-25",
        wide ? "w-full" : "",
        look[variant],
        className,
      ].join(" ")}
    >
      {children}
    </button>
  );
}
