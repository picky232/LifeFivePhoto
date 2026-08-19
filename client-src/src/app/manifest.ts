import type { MetadataRoute } from "next";

// manifest 는 라우트 핸들러로 취급되는데, 정적으로 뽑을 때는
// "이건 매번 새로 만들 필요 없다"고 알려줘야 파일로 떨어진다.
export const dynamic = "force-static";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "분당경영고 분경오컷",
    short_name: "분경오컷",
    description: "분당경영고 학과 홍보용 5컷 포토부스",
    start_url: "/",
    display: "standalone",
    background_color: "#F2F0E9",
    theme_color: "#3DDC97",
    icons: [
      {
        src: "/favicon.ico",
        sizes: "any",
        type: "image/x-icon",
      },
    ],
  };
}
