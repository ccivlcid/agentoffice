import { pickLang } from "../i18n";
import type { UiLanguage, LangText } from "../i18n";
import type { View, RuntimeOs } from "../appHelpers";
import type * as api from "../api";

export type AppLabels = {
  uiLanguage: UiLanguage;
  loadingTitle: string;
  loadingSubtitle: string;
  viewTitles: Record<View, string>;
  announcementLabel: string;
  reportLabel: string;
  tasksPrimaryLabel: string;
  agentStatusLabel: string;
  agentManagerLabel: string;
  decisionLabel: string;
};

export function computeAppLabels(uiLanguage: UiLanguage): AppLabels {
  const pl = (obj: LangText) => pickLang(uiLanguage, obj);
  return {
    uiLanguage,
    loadingTitle: pl({ ko: "하이퍼클에이전트 로딩 중...", en: "Loading HyperClaw..." }),
    loadingSubtitle: pl({ ko: "AI 에이전트 사무실을 준비하고 있습니다", en: "Preparing your AI agent office" }),
    viewTitles: {
      office: pl({ ko: "오피스", en: "Office" }),
      directives: pl({ ko: "업무지시", en: "Directives" }),
      dashboard: pl({ ko: "대시보드", en: "Dashboard" }),
      tasks: pl({ ko: "업무 관리", en: "Tasks" }),
      deliverables: pl({ ko: "결과물", en: "Deliverables" }),
      skills: pl({ ko: "스킬", en: "Skills" }),
      "skills-mcp": pl({ ko: "MCP 서버", en: "MCP Servers" }),
      "skills-rules": pl({ ko: "에이전트 룰", en: "Agent Rules" }),
      settings: pl({ ko: "설정", en: "Settings" }),
    },
    announcementLabel: pl({ ko: "전사 공지", en: "Announcement" }),
    reportLabel: pl({ ko: "보고서", en: "Reports" }),
    tasksPrimaryLabel: pl({ ko: "업무", en: "Tasks" }),
    agentStatusLabel: pl({ ko: "에이전트", en: "Agents" }),
    agentManagerLabel: pl({ ko: "에이전트 관리", en: "Agent Manager" }),
    decisionLabel: pl({ ko: "의사결정", en: "Decisions" }),
  };
}

export type UpdateBannerState = {
  updateBannerVisible: boolean;
  updateReleaseUrl: string;
  updateTitle: string;
  updateHint: string;
  updateReleaseLabel: string;
  updateDismissLabel: string;
  updateTestModeHint: string;
  autoUpdateNoticeVisible: boolean;
  autoUpdateNoticeTitle: string;
  autoUpdateNoticeHint: string;
  autoUpdateNoticeActionLabel: string;
  autoUpdateNoticeContainerClass: string;
  autoUpdateNoticeTextClass: string;
  autoUpdateNoticeHintClass: string;
  autoUpdateNoticeButtonClass: string;
  effectiveUpdateStatus: api.UpdateStatus | null;
};

export function computeUpdateBannerState(params: {
  uiLanguage: UiLanguage;
  theme: string;
  runtimeOs: RuntimeOs;
  forceUpdateBanner: boolean;
  updateStatus: api.UpdateStatus | null;
  dismissedUpdateVersion: string;
  autoUpdateNoticePending?: boolean;
}): UpdateBannerState {
  const { uiLanguage, theme, runtimeOs, forceUpdateBanner, updateStatus, dismissedUpdateVersion, autoUpdateNoticePending } = params;
  const pl = (obj: LangText) => pickLang(uiLanguage, obj);
  const effectiveUpdateStatus = forceUpdateBanner
    ? { current_version: updateStatus?.current_version ?? "1.1.0", latest_version: updateStatus?.latest_version ?? "1.1.1-test", update_available: true, release_url: updateStatus?.release_url ?? "https://github.com/YOUR_ORG/hyperclaw/releases/latest", checked_at: Date.now(), enabled: true, repo: updateStatus?.repo ?? "YOUR_ORG/hyperclaw", error: null }
    : updateStatus;
  const updateBannerVisible = Boolean(effectiveUpdateStatus?.enabled && effectiveUpdateStatus.update_available && effectiveUpdateStatus.latest_version && (forceUpdateBanner || effectiveUpdateStatus.latest_version !== dismissedUpdateVersion));
  const updateReleaseUrl = effectiveUpdateStatus?.release_url ?? `https://github.com/${effectiveUpdateStatus?.repo ?? "YOUR_ORG/hyperclaw"}/releases/latest`;
  const updateTitle = updateBannerVisible ? pl({ ko: `새 버전 v${effectiveUpdateStatus?.latest_version} 사용 가능 (현재 v${effectiveUpdateStatus?.current_version}).`, en: `New version v${effectiveUpdateStatus?.latest_version} is available (current v${effectiveUpdateStatus?.current_version}).` }) : "";
  const updateHint = runtimeOs === "windows"
    ? pl({ ko: "Windows PowerShell에서 `git pull; pnpm install` 실행 후 서버를 재시작하세요.", en: "In Windows PowerShell, run `git pull; pnpm install`, then restart the server." })
    : pl({ ko: "macOS/Linux에서 `git pull && pnpm install` 실행 후 서버를 재시작하세요.", en: "On macOS/Linux, run `git pull && pnpm install`, then restart the server." });
  const updateReleaseLabel = pl({ ko: "릴리즈 노트", en: "Release Notes" });
  const updateDismissLabel = pl({ ko: "나중에", en: "Dismiss" });
  const updateTestModeHint = forceUpdateBanner ? pl({ ko: "테스트 표시 모드입니다. `?force_update_banner=1`을 제거하면 원래 상태로 돌아갑니다.", en: "Test display mode is on. Remove `?force_update_banner=1` to return to normal behavior." }) : "";
  const autoUpdateNoticeVisible = Boolean(autoUpdateNoticePending);
  const autoUpdateNoticeTitle = pl({ ko: "업데이트 안내: 자동 업데이트 토글이 추가되었습니다.", en: "Update notice: Auto Update toggle has been added." });
  const autoUpdateNoticeHint = pl({ ko: "기존 설치(1.1.3 이하)에서는 기본값이 OFF입니다. Settings > General에서 필요 시 ON으로 전환할 수 있습니다.", en: "For existing installs (v1.1.3 and below), the default remains OFF. You can enable it in Settings > General when needed." });
  const autoUpdateNoticeActionLabel = pl({ ko: "확인", en: "Got it" });
  const autoUpdateNoticeContainerClass = theme === "light" ? "border-b border-sky-200 bg-sky-50 px-3 py-2.5 sm:px-4 lg:px-6" : "border-b border-sky-500/30 bg-sky-500/10 px-3 py-2.5 sm:px-4 lg:px-6";
  const autoUpdateNoticeTextClass = theme === "light" ? "min-w-0 text-xs text-sky-900" : "min-w-0 text-xs text-sky-100";
  const autoUpdateNoticeHintClass = theme === "light" ? "mt-0.5 text-[11px] text-sky-800" : "mt-0.5 text-[11px] text-sky-200/90";
  const autoUpdateNoticeButtonClass = theme === "light" ? "rounded-md border border-sky-300 bg-white px-2.5 py-1 text-[11px] text-sky-900 transition hover:bg-sky-100" : "rounded-md border border-sky-300/40 bg-sky-200/10 px-2.5 py-1 text-[11px] text-sky-100 transition hover:bg-sky-200/20";
  return {
    updateBannerVisible, updateReleaseUrl, updateTitle, updateHint, updateReleaseLabel,
    updateDismissLabel, updateTestModeHint, autoUpdateNoticeVisible, autoUpdateNoticeTitle,
    autoUpdateNoticeHint, autoUpdateNoticeActionLabel, autoUpdateNoticeContainerClass,
    autoUpdateNoticeTextClass, autoUpdateNoticeHintClass, autoUpdateNoticeButtonClass,
    effectiveUpdateStatus,
  };
}

