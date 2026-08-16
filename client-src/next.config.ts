import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // 이 앱은 노트북의 Express 서버가 정적 파일로 서빙한다 (LifeFivePhoto/server).
  // 그래서 Next 서버를 띄우지 않고 순수 HTML/JS 로 뽑아낸다.
  // 화면 전부가 클라이언트 컴포넌트라 서버 기능을 안 쓰므로 그대로 나간다.
  output: "export",

  // /debug 를 debug/index.html 로 뽑는다.
  // express.static 은 폴더 안의 index 를 찾으므로 이렇게 해야 주소가 맞는다.
  trailingSlash: true,

  // 정적 추출에는 Next 의 기본 이미지 최적화가 없다 (서버가 필요한 기능).
  // 학교 심벌·마스코트는 이미 알맞은 크기로 잘라둬서 최적화가 없어도 된다.
  images: { unoptimized: true },

  // 아이패드 실기기 테스트는 터널(https) 또는 같은 공유기의 LAN 주소로 들어온다.
  // Next는 기본적으로 localhost 외 출처의 개발용 요청을 막으므로 여기서 열어준다.
  allowedDevOrigins: [
    "*.trycloudflare.com",
    "172.30.1.*",
    "192.168.*.*",
    "192.168.137.*", // 노트북 핫스팟 대역
  ],
};

export default nextConfig;
