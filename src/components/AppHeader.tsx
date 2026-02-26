import type { DecisionInboxItem } from "./chat/decision-inbox";
import { Menu, ClipboardList, Compass, Loader2, Wrench, Megaphone, Users, FileBarChart, Palette, MoreVertical } from "lucide-react";

interface AppHeaderProps {
  viewTitle: string;
  tasksPrimaryLabel: string;
  decisionLabel: string;
  agentStatusLabel: string;
  agentManagerLabel: string;
  reportLabel: string;
  announcementLabel: string;
  roomManagerLabel: string;
  decisionInboxItems: DecisionInboxItem[];
  decisionInboxLoading: boolean;
  theme: string;
  connected: boolean;
  mobileHeaderMenuOpen: boolean;
  onOpenMobileNav: () => void;
  onNavigateTasks: () => void;
  onOpenDecisionInbox: () => void;
  onOpenAgentStatus: () => void;
  onOpenReportHistory: () => void;
  onOpenAnnouncement: () => void;
  onOpenRoomManager: () => void;
  onOpenAgentManager: () => void;
  onToggleTheme: () => void;
  onToggleMobileHeaderMenu: () => void;
  onCloseMobileHeaderMenu: () => void;
}

export function AppHeader(props: AppHeaderProps) {
  const {
    viewTitle, tasksPrimaryLabel, decisionLabel, agentStatusLabel, reportLabel,
    announcementLabel, agentManagerLabel, roomManagerLabel, decisionInboxItems, decisionInboxLoading,
    theme, connected, mobileHeaderMenuOpen,
    onOpenMobileNav, onNavigateTasks, onOpenDecisionInbox,
    onOpenAgentStatus, onOpenAgentManager, onOpenReportHistory, onOpenAnnouncement, onOpenRoomManager,
    onToggleTheme, onToggleMobileHeaderMenu, onCloseMobileHeaderMenu,
  } = props;

  return (
    <header
      className="sticky top-0 z-30 flex items-center justify-between px-3 py-2 backdrop-blur-sm sm:px-4 sm:py-3 lg:px-6"
      style={{ borderBottom: "1px solid var(--th-border)", background: "var(--th-bg-header)" }}
    >
      <div className="flex min-w-0 items-center gap-2">
        <button
          onClick={onOpenMobileNav}
          className="inline-flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg transition lg:hidden"
          style={{ border: "1px solid var(--th-border)", background: "var(--th-bg-surface)", color: "var(--th-text-secondary)" }}
          aria-label="Open navigation"
        >
          <Menu width={18} height={18} />
        </button>
        <h1 className="truncate text-base font-bold sm:text-lg" style={{ color: "var(--th-text-heading)" }}>
          {viewTitle}
        </h1>
      </div>

      <div className="flex items-center gap-2 sm:gap-3">
        <button onClick={onNavigateTasks} className="header-action-btn header-action-btn-primary" aria-label={tasksPrimaryLabel}>
          <ClipboardList width={16} height={16} className="sm:hidden" />
          <span className="hidden sm:inline-flex items-center gap-1.5"><ClipboardList width={16} height={16} /> {tasksPrimaryLabel}</span>
        </button>
        <button
          onClick={onOpenDecisionInbox}
          disabled={decisionInboxLoading}
          className={`header-action-btn header-action-btn-secondary disabled:cursor-wait disabled:opacity-60${decisionInboxItems.length > 0 ? " decision-has-pending" : ""}`}
          aria-label={decisionLabel}
        >
          {decisionInboxLoading
            ? <Loader2 width={16} height={16} className="animate-spin sm:hidden" />
            : <Compass width={16} height={16} className="sm:hidden" />}
          <span className="hidden sm:inline-flex items-center gap-1.5">
            {decisionInboxLoading ? <Loader2 width={16} height={16} className="animate-spin" /> : <Compass width={16} height={16} />} {decisionLabel}
          </span>
          {decisionInboxItems.length > 0 && <span className="header-decision-badge">{decisionInboxItems.length}</span>}
        </button>
        <button onClick={onOpenAgentStatus} className="header-action-btn header-action-btn-secondary mobile-hidden">
          <span className="inline-flex items-center gap-1.5"><Wrench width={16} height={16} /> {agentStatusLabel}</span>
        </button>
        <button onClick={onOpenAgentManager} className="header-action-btn header-action-btn-secondary mobile-hidden">
          <span className="inline-flex items-center gap-1.5"><Users width={16} height={16} /> {agentManagerLabel}</span>
        </button>
        <button onClick={onOpenReportHistory} className="header-action-btn header-action-btn-secondary mobile-hidden">
          <span className="inline-flex items-center gap-1.5"><FileBarChart width={16} height={16} /> {reportLabel}</span>
        </button>
        <button onClick={onOpenAnnouncement} className="header-action-btn header-action-btn-secondary">
          <Megaphone width={16} height={16} className="sm:hidden" />
          <span className="hidden sm:inline-flex items-center gap-1.5"><Megaphone width={16} height={16} /> {announcementLabel}</span>
        </button>
        <button onClick={onOpenRoomManager} className="header-action-btn header-action-btn-secondary mobile-hidden">
          <span className="inline-flex items-center gap-1.5"><Palette width={16} height={16} /> {roomManagerLabel}</span>
        </button>

        <button
          onClick={onToggleTheme}
          className="theme-toggle-btn"
          aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
          title={theme === "dark" ? "라이트 모드" : "다크 모드"}
        >
          <span className="theme-toggle-icon">
            {theme === "dark" ? (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
              </svg>
            ) : (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="5" />
                <line x1="12" y1="1" x2="12" y2="3" /><line x1="12" y1="21" x2="12" y2="23" />
                <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" /><line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
                <line x1="1" y1="12" x2="3" y2="12" /><line x1="21" y1="12" x2="23" y2="12" />
                <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" /><line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
              </svg>
            )}
          </span>
        </button>

        {/* Mobile overflow menu */}
        <div className="relative sm:hidden">
          <button
            onClick={onToggleMobileHeaderMenu}
            className="inline-flex h-8 w-8 items-center justify-center rounded-lg transition"
            style={{ border: "1px solid var(--th-border)", background: "var(--th-bg-surface)", color: "var(--th-text-secondary)" }}
            aria-label="더보기 메뉴"
          >
            <MoreVertical width={18} height={18} />
          </button>
          {mobileHeaderMenuOpen && (
            <>
              <button className="fixed inset-0 z-40" onClick={onCloseMobileHeaderMenu} aria-label="Close menu" />
              <div className="absolute right-0 top-full z-50 mt-1 min-w-[180px] rounded-lg py-1 shadow-lg"
                style={{ border: "1px solid var(--th-border)", background: "var(--th-bg-surface)" }}>
                <button onClick={() => { onOpenAgentStatus(); onCloseMobileHeaderMenu(); }}
                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm transition hover:opacity-80"
                  style={{ color: "var(--th-text-primary)" }}>
                  <Wrench width={16} height={16} /> {agentStatusLabel}
                </button>
                <button onClick={() => { onOpenAgentManager(); onCloseMobileHeaderMenu(); }}
                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm transition hover:opacity-80"
                  style={{ color: "var(--th-text-primary)" }}>
                  <Users width={16} height={16} /> {agentManagerLabel}
                </button>
                <button onClick={() => { onOpenReportHistory(); onCloseMobileHeaderMenu(); }}
                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm transition hover:opacity-80"
                  style={{ color: "var(--th-text-primary)" }}>
                  <FileBarChart width={16} height={16} /> {reportLabel}
                </button>
                <button onClick={() => { onOpenRoomManager(); onCloseMobileHeaderMenu(); }}
                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm transition hover:opacity-80"
                  style={{ color: "var(--th-text-primary)" }}>
                  <Palette width={16} height={16} /> {roomManagerLabel}
                </button>
              </div>
            </>
          )}
        </div>

        <div className="flex items-center gap-2 text-xs" style={{ color: "var(--th-text-muted)" }}>
          <div className={`w-2 h-2 rounded-full ${connected ? "bg-green-500" : "bg-red-500"}`} />
          <span className="hidden sm:inline">{connected ? "Live" : "Offline"}</span>
        </div>
      </div>
    </header>
  );
}
