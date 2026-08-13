'use strict';

const fs = require('fs');
const path = require('path');
const mkcert = require('mkcert');

const CERT_DIR = path.join(__dirname, 'certs');
const CA_DIR = path.join(CERT_DIR, 'ca');

// 서버 인증서에 넣을 주소 목록.
// 192.168.137.1 은 Windows 모바일 핫스팟이 자기 자신에게 부여하는 고정 주소이고,
// 192.168.138.1 은 공유 연결이 둘 이상일 때 Windows가 대신 잡는 대역이다.
// localhost / 127.0.0.1 은 노트북에서 직접 확인할 때 쓴다.
const DOMAINS = ['192.168.137.1', '192.168.138.1', 'localhost', '127.0.0.1'];

const CA_VALIDITY_DAYS = 3650;
const CERT_VALIDITY_DAYS = 825;

const CA_CERT_PATH = path.join(CA_DIR, 'rootCA.pem');
const CA_KEY_PATH = path.join(CA_DIR, 'rootCA-key.pem');
const SERVER_CERT_PATH = path.join(CERT_DIR, 'server.pem');
const SERVER_KEY_PATH = path.join(CERT_DIR, 'server-key.pem');

/**
 * CA가 이미 있으면 그대로 쓴다.
 * 아이패드에 한 번 설치한 CA를 계속 신뢰하게 하려면 CA를 새로 만들면 안 된다.
 */
async function loadOrCreateCA() {
  if (fs.existsSync(CA_CERT_PATH) && fs.existsSync(CA_KEY_PATH)) {
    console.log('기존 CA 사용:', CA_CERT_PATH);

    return {
      cert: fs.readFileSync(CA_CERT_PATH, 'utf8'),
      key: fs.readFileSync(CA_KEY_PATH, 'utf8'),
    };
  }

  console.log('새 CA 생성 중...');

  const ca = await mkcert.createCA({
    organization: 'LifeFivePhoto Local CA',
    countryCode: 'KR',
    state: 'Seoul',
    locality: 'Seoul',
    validity: CA_VALIDITY_DAYS,
  });

  fs.writeFileSync(CA_CERT_PATH, ca.cert);
  fs.writeFileSync(CA_KEY_PATH, ca.key);

  return ca;
}

async function main() {
  fs.mkdirSync(CA_DIR, { recursive: true });

  const ca = await loadOrCreateCA();

  console.log('서버 인증서 생성 중...');

  const cert = await mkcert.createCert({
    ca,
    domains: DOMAINS,
    validity: CERT_VALIDITY_DAYS,
    organization: 'LifeFivePhoto Local Server',
  });

  fs.writeFileSync(SERVER_CERT_PATH, cert.cert);
  fs.writeFileSync(SERVER_KEY_PATH, cert.key);

  console.log('');
  console.log('완료.');
  console.log(`  서버 인증서: ${SERVER_CERT_PATH}`);
  console.log(`  서버 키:     ${SERVER_KEY_PATH}`);
  console.log(`  포함 주소:   ${DOMAINS.join(', ')}`);
  console.log(`  유효기간:    ${CERT_VALIDITY_DAYS}일`);
  console.log('');
  console.log('아이패드에 설치할 파일:');
  console.log(`  ${CA_CERT_PATH}`);
  console.log('');
  console.log('설치 절차:');
  console.log('  1. rootCA.pem 을 아이패드로 전달 (메일 / 클라우드 / AirDrop)');
  console.log('  2. 아이패드에서 파일을 열면 "프로파일이 다운로드됨" 알림이 뜬다');
  console.log('  3. 설정 > 일반 > VPN 및 기기 관리 > 해당 프로파일 > 설치');
  console.log('  4. 설정 > 일반 > 정보 > 인증서 신뢰 설정 > LifeFivePhoto Local CA 켜기');
  console.log('');
  console.log('4번을 빼먹으면 프로파일을 설치해도 Safari가 인증서를 신뢰하지 않는다.');
}

main().catch((err) => {
  console.error('인증서 생성 실패:', err);
  process.exit(1);
});
