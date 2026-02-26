# project-commands

HAIFeR Web IDE 프로젝트에서 자주 쓰는 **Windows PowerShell** 명령어 모음.

## 의존성 설치

```powershell
# 루트: pnpm 의존성 (모노레포 전체)
pnpm install

# 웹 앱만
pnpm install --filter @haiferwebide/web

# API 백엔드 Python 가상환경 + 패키지
Set-Location apps\api-backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
Set-Location ..\..
```

## 개발 서버 실행

```powershell
# 전체 (Turbo): 웹 + API 등 동시 실행
pnpm dev

# 웹(Next.js)만 — 포트 3001
pnpm turbo run dev --filter=web

# API 백엔드(FastAPI)만 — 포트 8000
Set-Location apps\api-backend
.\.venv\Scripts\Activate.ps1
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
Set-Location ..\..
```

## 빌드 / 린트 / 타입체크

```powershell
# 전체 빌드
pnpm build

# 전체 린트
pnpm lint

# 전체 타입 체크
pnpm type-check

# 전체 클린
pnpm clean
```

## 테스트

```powershell
# Turbo로 전체 테스트
pnpm test
```

## 개발 완료 시: 오류 체크 + 테스트 한 번에

```powershell
# lint → type-check → test 순서 실행 (하나라도 실패하면 중단)
pnpm run check
```

- **수동**: 개발 끝났을 때 위 명령 실행
- **자동**: Cursor Agent Hooks (`.cursor/hooks.json`) — 세션 종료·작업 중단 시 `pnpm run check` 자동 실행. Git 훅은 사용하지 않음.

## Git (PowerShell)

```powershell
# 새 기능 브랜치
git checkout -b feature/브랜치이름

# 상태 확인
git status
```

## 경로 참고

- 프로젝트 루트: `c:\PythonProjects\haiferwebide\haiferwebide` (또는 현재 워크스페이스)
- 웹 앱: `apps\web`
- API 백엔드: `apps\api-backend`

---

이 명령어는 채팅에서 `/project-commands` 로 불러와 사용할 수 있습니다.
