# HAIFeR Agent — 오픈소스 포크 기반 진행 방안

이 문서는 **오픈소스를 가져와 브랜드·저장소만 변경한 상태**에서, 어떤 순서로 정리·운영하면 좋을지 정리한 가이드입니다.

---

## 1. 현재 상태 정리

- **README_ko.md**: 프로젝트명·저장소명을 HAIFeR Agent / haiferagent로 통일 완료.
- **코드·설정·다른 문서**: 아직 원본(HyperClaw / haiferclaw 등) 참조가 남아 있을 수 있음.
- **라이선스**: 원본 소스에는 **별도 라이선스 파일이 없음**. HAIFeR Agent 배포 시 필요하면 자체 LICENSE를 추가할 수 있음.

---

## 2. 권장 진행 순서

### 2.1 이미지·에셋 변경 (우선 권장)

- **로고·파비콘:** `public/hyperclaw.svg` — index.html(파비콘), README.md 에서 사용. 내용 교체하거나 `haiferagent.svg` 추가 후 참조 수정.
- **부가 에셋:** `public/claw-empire.svg`, `public/climpire.svg` 사용처 확인 후 필요 시 교체.
- **슬라이드/문서:** `docs/reports/Sample_Slides/`, `slides/` HTML 내 이미지 경로 수정.
- (원본에 LICENSE 없음 — 배포 시 자체 LICENSE 추가 검토.)
### 2.2 문서·문구 통일

- [ ] **README.md**(영문)가 있다면 동일하게 HAIFeR Agent / haiferagent로 수정.
- [ ] **package.json**의 `name`, `description` 등을 haiferagent에 맞게 조정.
- [ ] **AGENTS.md** 등 에이전트 규칙에 “HyperClaw” 문구가 있으면 용도에 맞게 “HAIFeR Agent” 또는 “haifer agent”로 통일할지 결정 후 수정.
- [ ] **docs/** 내 DESIGN.md, RENEWAL_GUIDE.md, 릴리즈 노트 등에서 브랜드/저장소 참조 검색 후 필요 시 수정.

### 2.4 코드·설정 내 참조 점검

- [ ] 코드베이스에서 `hyperclaw`, `haiferclaw`, `HyperClaw` 검색 후,  
  - 앱 이름/로그/UI 문구 → HAIFeR Agent 등으로 변경  
  - DB 경로/기본값(`hyperclaw.sqlite` 등) → `haiferagent.sqlite` 등으로 변경  
  - 저장소 URL/업데이트 체크용 슬러그 → haiferagent 저장소로 변경
- [ ] **.env.example** 등에 `UPDATE_CHECK_REPO`, `DB_PATH` 기본값이 있다면 haiferagent 기준으로 수정.

### 2.5 저장소·배포 정책

- [ ] GitHub(또는 사용 중인 호스트)에 **haiferagent** 저장소 생성 후 원격 연결.
- [ ] upstream(원본)을 `git remote add upstream <원본 URL>` 로 추가해 두면, 나중에 원본 버그 수정·기능 반영 시 참고하기 좋음.
- [ ] 브랜치 전략 결정:  
  - 예: `main` = 안정 버전, `dev` = 개발, `feature/xxx` = 기능 단위.  
  - 원본과 동기화할 계획이 있다면 `main`/`dev`와 upstream 병합 주기만 정해 두면 됨.

### 2.6 차별화·운영 방향 정리

- [ ] “몇 가지 내용만 변경”한 부분을 문서로 정리하면 유지보수에 유리합니다.  
  - 예: `docs/CUSTOMIZATION.md` 에 “원본 대비 변경 사항(브랜드, DB 이름, 업데이트 Repo 등)” 목록 작성.
- [ ] 앞으로 **HAIFeR Agent만의 기능/정책**을 추가할 계획이 있다면, 같은 문서에 “예정 차별화 항목”을 적어 두면 좋습니다.

### 2.7 CI·배포·보안

- [ ] 원본에 있던 **preflight/보안 스크립트**(예: `pnpm run preflight:public`)가 있다면 그대로 실행 가능한지 확인.
- [ ] 필요 시 자체 CI(예: GitHub Actions)에서 빌드·테스트·린트만 돌리도록 최소 설정 추가.
- [ ] 배포 방식(로컬 전용 / 내부 서버 / 공개)을 정한 뒤, `.env` 예시와 README의 “실행 모드”를 그에 맞게 유지.

---

## 3. 체크리스트 요약

| 단계 | 항목 | 비고 |
|------|------|------|
| 1 | **이미지/에셋 변경** (로고, 파비콘, 슬라이드) | 우선 권장 |
| 2 | 라이선스·원저작자 표기 (원본에 LICENSE 있을 때만) | 선택 |
| 3 | README(영문)·package.json·AGENTS·docs 브랜드 통일 | 권장 |
| 4 | 코드/설정 내 hyperclaw·haiferclaw·DB/Repo 참조 수정 | 권장 |
| 5 | 원격 저장소·upstream·브랜치 전략 | 운영 필요 시 |
| 6 | CUSTOMIZATION.md 등 차별화 문서 | 장기 유지보수용 |
| 7 | CI·보안·배포 정책 | 팀 정책에 맞게 |

---

## 4. 다음에 할 일

1. 위 체크리스트 순서대로 **이미지/에셋** → 문서·코드 참조 순으로 처리.
2. 변경 범위가 크면 `tasks/todo.md` 등에 작업 목록을 적고, 완료된 항목만 체크해 나가면 진행 상황을 추적하기 쉽습니다.
3. 원본 upstream과의 동기화는 “필요한 시점에 선택적으로” 진행해도 됩니다.  
   - 먼저 HAIFeR Agent 기준으로 문서·코드를 안정화한 뒤, upstream 병합 여부를 결정하는 것을 권장합니다.

이 문서는 HAIFeR Agent 저장소의 `docs/FORK_PROGRESS.md` 에 두고, 진행하면서 내용을 보완해 나가면 됩니다.
