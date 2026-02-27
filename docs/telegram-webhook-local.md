# 로컬 환경에서 Telegram 웹훅 설정

로컬에서 HyperClaw 서버(포트 8790)를 실행 중일 때, 텔레그램 봇이 보낸 메시지를 받으려면 **ngrok** 등으로 로컬 서버를 인터넷에 잠깐 노출한 뒤, Telegram에 웹훅 URL을 등록해야 합니다.

---

## 1. 세션키란?

- **세션키**는 채널을 추가할 때 서버가 자동으로 부여하는 **고유 ID(UUID)** 입니다.
- 앱 **설정 → 채널 메시지** 탭에서 Telegram 채널 카드에  
  `웹훅: /api/telegram/webhook/xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx`  
  형태로 표시됩니다. 마지막에 붙은 `xxxxxxxx-xxxx-...` 부분이 **세션키**입니다.
- 웹훅 URL에 세션키를 넣어서, “이 요청은 어떤 채널(봇) 설정으로 처리할지” 구분합니다.

---

## 2. 로컬에서 웹훅 받기 (ngrok 예시)

### 2.1 ngrok 설치 및 실행

1. [ngrok](https://ngrok.com/) **가입** 후 설치 (사이트에서 다운로드 또는 `winget install ngrok.ngrok` 등).
2. **Authtoken 등록** (ngrok v3 필수):
   - [ngrok 대시보드 → Your Authtoken](https://dashboard.ngrok.com/get-started/your-authtoken) 에서 토큰 복사.
   - 터미널에서 한 번만 실행:
     ```powershell
     ngrok config add-authtoken <여기에_복사한_토큰>
     ```
   - `ERR_NGROK_4018` / "authentication failed" 가 나왔다면 이 단계를 먼저 하세요.
3. 터미널에서 서버 포트를 노출합니다.

   ```powershell
   ngrok http 8790
   ```

4. 터미널에 나온 **HTTPS 주소**를 복사합니다 (아래 2.2에서 사용).

   **PowerShell에서 `ngrok`을 찾을 수 없다면** (winget 설치 직후 PATH 미반영 시):

   - **방법 A** — 새 터미널을 열고 다시 `ngrok http 8790` 실행.
   - **방법 B** — 전체 경로로 실행 (winget 기본 경로 예시):
     ```powershell
   & "$env:LOCALAPPDATA\Microsoft\WinGet\Packages\Ngrok.Ngrok_Microsoft.Winget.Source_8wekyb3d8bbwe\ngrok.exe" http 8790
     ```
   - **방법 C** — 현재 세션에서 PATH만 새로고침한 뒤 실행:
     ```powershell
   $env:Path = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path","User")
   ngrok http 8790
     ```

   예: https://api.telegram.org/botAAGjYJouj3IFQArBaIxPsWdY_UD8mzOse60/setWebhook?url=https://ameer-thoroughgoing-tryingly.ngrok-free.dev/webhook


### 2.2 웹훅 URL 만들기

- 형식: `https://<ngrok주소>/api/telegram/webhook/<세션키>`
- 예:  
  `https://abc123.ngrok-free.app/api/telegram/webhook/a1b2c3d4-e5f6-7890-abcd-ef1234567890`
- 세션키는 앱 **설정 → 채널 메시지**에서 해당 Telegram 채널 카드의 웹훅 경로 끝에 있습니다.

### 2.3 Telegram에 웹훅 등록

브라우저 주소창에 다음 URL을 넣어 접속합니다.

```
https://api.telegram.org/bot<봇토큰>/setWebhook?url=https://<ngrok주소>/api/telegram/webhook/<세션키>
```

- **봇토큰**: 채널 추가 시 입력한 Telegram Bot Token (BotFather에서 발급).
- **ngrok주소**: 위에서 복사한 `https://...` 의 호스트 부분만 (예: `abc123.ngrok-free.app`).
- **세션키**: 채널 카드에 표시된 세션키.

예시 (실제 값으로 바꿔서 사용):

```
https://api.telegram.org/bot123456:ABC-DEF.../setWebhook?url=https://abc123.ngrok-free.app/api/telegram/webhook/a1b2c3d4-e5f6-7890-abcd-ef1234567890
```

응답에 `"ok":true` 가 오면 등록 완료입니다.

### 2.4 동작 확인

1. 로컬에서 HyperClaw 서버 실행 (`pnpm dev:local` 등).
2. ngrok 터널 실행 유지 (`ngrok http 8790`).
3. 해당 봇과 텔레그램에서 대화한 뒤, `$ 테스트` 또는 `테스트` 입력.
4. 봇이 “팀장 소집 회의를 진행할까요? 1️⃣ … 2️⃣ …” 로 응답하면 수신·처리 정상입니다.

---

## 3. 참고

- ngrok을 끄면 Telegram이 로컬 서버로 요청을 보낼 수 없어, 다시 메시지 수신이 안 됩니다. 로컬 테스트할 때만 터널을 켜 두면 됩니다.
- 웹훅을 지우려면:  
  `https://api.telegram.org/bot<봇토큰>/deleteWebhook`
