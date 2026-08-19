import type { Metadata, Viewport } from "next";
import { Black_Han_Sans, Geist_Mono } from "next/font/google";
import "./globals.css";

/**
 * 제목용 한글 폰트. 원래 포스터용으로 만들어진 서체라 크게 쓸수록 제 모양이 난다.
 * 본문까지 웹폰트로 쓰면 내려받을 파일이 수백 개로 늘어나므로,
 * 본문은 기기 기본 한글 폰트(아이패드는 Apple SD Gothic Neo)에 맡긴다.
 */
const displayFont = Black_Han_Sans({
  weight: "400",
  subsets: ["latin"], // 한글 글리프는 subsets 선언과 무관하게 함께 포함된다
  variable: "--font-bhs",
  display: "swap",
});

/** 진단 화면의 수치 표시용 */
const monoFont = Geist_Mono({
  subsets: ["latin"],
  variable: "--font-geist-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "분당경영고 분경오컷",
  description: "분당경영고 학과 홍보용 5컷 포토부스",
  appleWebApp: {
    capable: true,
    title: "분경오컷",
    statusBarStyle: "default",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
  themeColor: "#F2F0E9",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="ko"
      className={`${displayFont.variable} ${monoFont.variable} h-full antialiased`}
    >
      <body className="bg-paper text-ink flex min-h-full flex-col">{children}</body>
    </html>
  );
}
