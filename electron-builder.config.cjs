"use strict";
// 출력을 release-new로 고정해, 이전 빌드(release)가 잠겨 있어도 새 빌드가 성공하도록 함.
// signAndEditExecutable: false → winCodeSign 미다운로드(Windows에서 심볼릭 링크 오류 방지)
// asar: false → app 폴더로 패키징해 dist-server 실행 가능. extraResources → Node 번들(설치 PC에 Node 불필요)
module.exports = {
  directories: { output: "release-new" },
  asar: false,
  extraResources: [{ from: "build/node", to: "node", filter: ["**/*"] }],
  forceCodeSigning: false,
  win: {
    signAndEditExecutable: false,
  },
};
