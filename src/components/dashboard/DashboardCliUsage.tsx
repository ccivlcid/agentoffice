import { useEffect, useRef, useState, useCallback } from "react";
import type { CliStatusMap, Task } from "../../types";
import { getCliStatus, getCliUsage, refreshCliUsage, type CliUsageEntry } from "../../api";
import type { LangText, UiLanguage } from "../../i18n";
import CliUsagePanel from "../office-view/CliUsagePanel";

const ClaudeLogo = () => (
  <svg width="18" height="18" viewBox="0 0 400 400" fill="none">
    <path
      fill="#D97757"
      d="m124.011 241.251 49.164-27.585.826-2.396-.826-1.333h-2.396l-8.217-.506-28.09-.759-24.363-1.012-23.603-1.266-5.938-1.265L75 197.79l.574-3.661 4.994-3.358 7.153.625 15.808 1.079 23.722 1.637 17.208 1.012 25.493 2.649h4.049l.574-1.637-1.384-1.012-1.079-1.012-24.548-16.635-26.573-17.58-13.919-10.123-7.524-5.129-3.796-4.808-1.637-10.494 6.833-7.525 9.178.624 2.345.625 9.296 7.153 19.858 15.37 25.931 19.098 3.796 3.155 1.519-1.08.185-.759-1.704-2.851-14.104-25.493-15.049-25.931-6.698-10.747-1.772-6.445c-.624-2.649-1.08-4.876-1.08-7.592l7.778-10.561L144.729 75l10.376 1.383 4.37 3.797 6.445 14.745 10.443 23.215 16.197 31.566 4.741 9.364 2.53 8.672.945 2.649h1.637v-1.519l1.332-17.782 2.464-21.832 2.395-28.091.827-7.912 3.914-9.482 7.778-5.129 6.074 2.902 4.994 7.153-.692 4.623-2.969 19.301-5.821 30.234-3.796 20.245h2.21l2.531-2.53 10.241-13.599 17.208-21.511 7.593-8.537 8.857-9.431 5.686-4.488h10.747l7.912 11.76-3.543 12.147-11.067 14.037-9.178 11.895-13.16 17.714-8.216 14.172.759 1.131 1.957-.186 29.727-6.327 16.062-2.901 19.166-3.29 8.672 4.049.944 4.116-3.408 8.419-20.498 5.062-24.042 4.808-35.801 8.469-.439.321.506.624 16.13 1.519 6.9.371h16.888l31.448 2.345 8.217 5.433 4.926 6.647-.827 5.061-12.653 6.445-17.074-4.049-39.85-9.482-13.666-3.408h-1.889v1.131l11.388 11.135 20.87 18.845 26.133 24.295 1.333 6.006-3.357 4.741-3.543-.506-22.962-17.277-8.858-7.777-20.06-16.888H238.5v1.771l4.623 6.765 24.413 36.696 1.265 11.253-1.771 3.661-6.327 2.21-6.951-1.265-14.29-20.06-14.745-22.591-11.895-20.246-1.451.827-7.018 75.601-3.29 3.863-7.592 2.902-6.327-4.808-3.357-7.778 3.357-15.37 4.049-20.06 3.29-15.943 2.969-19.807 1.772-6.58-.118-.439-1.451.186-14.931 20.498-22.709 30.689-17.968 19.234-4.302 1.704-7.458-3.864.692-6.9 4.167-6.141 24.869-31.634 14.999-19.605 9.684-11.32-.068-1.637h-.573l-66.052 42.887-11.759 1.519-5.062-4.741.625-7.778 2.395-2.531 19.858-13.665-.068.067z"
    />
  </svg>
);
const ChatGPTLogo = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
    <path
      d="M22.282 9.821a5.985 5.985 0 00-.516-4.91 6.046 6.046 0 00-6.51-2.9A6.065 6.065 0 0011.708.413a6.12 6.12 0 00-5.834 4.27 5.984 5.984 0 00-3.996 2.9 6.043 6.043 0 00.743 7.097 5.98 5.98 0 00.51 4.911 6.051 6.051 0 006.515 2.9A5.985 5.985 0 0013.192 24a6.116 6.116 0 005.84-4.27 5.99 5.99 0 003.997-2.9 6.056 6.056 0 00-.747-7.01z"
      fill="#10A37F"
    />
  </svg>
);
const GeminiLogo = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
    <path
      d="M12 0C12 6.627 6.627 12 0 12c6.627 0 12 5.373 12 12 0-6.627 5.373-12 12-12-6.627 0-12-5.373-12-12z"
      fill="url(#gemini_grad_dash)"
    />
    <defs>
      <linearGradient id="gemini_grad_dash" x1="0" y1="0" x2="24" y2="24" gradientUnits="userSpaceOnUse">
        <stop stopColor="#4285F4" />
        <stop offset="1" stopColor="#886FBF" />
      </linearGradient>
    </defs>
  </svg>
);
const CopilotRocketLogo = () => (
  <svg
    width="18"
    height="18"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className="text-amber-400"
  >
    <path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09z" />
    <path d="m12 15-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2z" />
    <path d="M9 12H4s.55-3.03 2-4c1.62-1.08 5 0 5 0" />
    <path d="M12 15v5s3.03-.55 4-2c1.08-1.62 0-5 0-5" />
  </svg>
);
const AntigravityGalaxyLogo = () => (
  <svg
    width="18"
    height="18"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    className="text-pink-400"
  >
    <circle cx="12" cy="12" r="3" fill="currentColor" fillOpacity="0.4" />
    <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" />
    <path d="M12 6a6 6 0 0 1 6 6 6 6 0 0 1-6 6 6 6 0 0 1-6-6 6 6 0 0 1 6-6z" strokeDasharray="2 2" opacity="0.7" />
  </svg>
);

const CursorLogo = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="text-cyan-400">
    <path d="M12 2L4 6v12l8 4 8-4V6l-8-4z" />
    <path d="M12 6v12M8 8l8 4" strokeOpacity="0.7" />
  </svg>
);

const CLI_DISPLAY = [
  {
    key: "claude",
    name: "Claude",
    icon: <ClaudeLogo />,
    color: "text-violet-300",
    bgColor: "bg-violet-500/15 border-violet-400/30",
  },
  {
    key: "codex",
    name: "Codex",
    icon: <ChatGPTLogo />,
    color: "text-emerald-300",
    bgColor: "bg-emerald-500/15 border-emerald-400/30",
  },
  {
    key: "gemini",
    name: "Gemini",
    icon: <GeminiLogo />,
    color: "text-blue-300",
    bgColor: "bg-blue-500/15 border-blue-400/30",
  },
  {
    key: "cursor",
    name: "Cursor",
    icon: <CursorLogo />,
    color: "text-cyan-300",
    bgColor: "bg-cyan-500/15 border-cyan-400/30",
  },
  {
    key: "copilot",
    name: "Copilot",
    icon: <CopilotRocketLogo />,
    color: "text-amber-300",
    bgColor: "bg-amber-500/15 border-amber-400/30",
  },
  {
    key: "antigravity",
    name: "Antigravity",
    icon: <AntigravityGalaxyLogo />,
    color: "text-pink-300",
    bgColor: "bg-pink-500/15 border-pink-400/30",
  },
];

interface DashboardCliUsageProps {
  tasks: Task[];
  language: UiLanguage;
  t: (obj: LangText) => string;
}

export default function DashboardCliUsage({ tasks, language, t }: DashboardCliUsageProps) {
  const [cliStatus, setCliStatus] = useState<CliStatusMap | null>(null);
  const [cliUsage, setCliUsage] = useState<Record<string, CliUsageEntry> | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const doneCountRef = useRef(0);

  useEffect(() => {
    getCliStatus()
      .then(setCliStatus)
      .catch(() => {});
    getCliUsage()
      .then((r) => {
        if (r.ok) setCliUsage(r.usage);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    const doneCount = tasks.filter((tk) => tk.status === "done").length;
    if (doneCountRef.current > 0 && doneCount > doneCountRef.current) {
      refreshCliUsage()
        .then((r) => {
          if (r.ok) setCliUsage(r.usage);
        })
        .catch(() => {});
    }
    doneCountRef.current = doneCount;
  }, [tasks]);

  const handleRefresh = useCallback(() => {
    if (refreshing) return;
    setRefreshing(true);
    refreshCliUsage()
      .then((r) => {
        if (r.ok) setCliUsage(r.usage);
      })
      .catch(() => {})
      .finally(() => setRefreshing(false));
  }, [refreshing]);

  const connectedClis = CLI_DISPLAY.filter((c) => {
    const s = cliStatus?.[c.key as keyof CliStatusMap];
    return s?.installed && s?.authenticated;
  });

  if (connectedClis.length === 0) return null;

  return (
    <CliUsagePanel
      connectedClis={connectedClis}
      cliUsage={cliUsage}
      refreshing={refreshing}
      language={language}
      t={t}
      onRefresh={handleRefresh}
    />
  );
}
