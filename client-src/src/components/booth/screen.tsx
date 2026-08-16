import type { ReactNode } from "react";

/**
 * 화면 바탕색.
 *
 * 전부 같은 색이면 여덟 단계가 한 덩어리로 뭉개진다. 흐름에 리듬을 주되,
 * 색을 고르는 기준은 취향이 아니라 기능이다:
 *   paper — 읽는 화면. 행사장은 밝으니 종이색이 가장 잘 읽힌다.
 *   dark  — 카메라·사진을 보는 화면. 주변이 어두워야 사진이 산다.
 *   mint  — 부스의 얼굴. 멀리서도 "저게 그거다"가 보여야 하는 화면.
 */
export type Tone = "paper" | "dark" | "mint";

const TONE: Record<Tone, string> = {
  paper: "bg-paper text-ink",
  dark: "bg-dark text-paper",
  mint: "bg-mint text-ink",
};

export function Screen({
  tone = "paper",
  children,
  className = "",
}: {
  tone?: Tone;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`animate-enter flex min-h-0 flex-1 flex-col ${TONE[tone]} ${className}`}
      style={{
        paddingTop: "max(env(safe-area-inset-top), 1.5rem)",
        paddingBottom: "max(env(safe-area-inset-bottom), 1.5rem)",
        paddingLeft: "max(env(safe-area-inset-left), 2rem)",
        paddingRight: "max(env(safe-area-inset-right), 2rem)",
      }}
    >
      {children}
    </div>
  );
}

/**
 * 화면 맨 위 한 줄. 왼쪽에 단계 이름, 오른쪽에 진행 위치.
 * 눈에 띄는 알약 라벨 대신 규칙선 하나로 정리한다.
 */
export function TopRule({
  label,
  right,
  onDark = false,
}: {
  label: string;
  right?: ReactNode;
  onDark?: boolean;
}) {
  const line = onDark ? "border-paper/25" : "border-ink/20";
  const dim = onDark ? "text-paper/55" : "text-ink-60";

  return (
    <div className={`flex items-baseline justify-between border-b pb-3 ${line}`}>
      <span className={`text-lg font-semibold ${dim}`}>{label}</span>
      {right}
    </div>
  );
}
