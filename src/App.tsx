import { useEffect, useState, useCallback, useRef, useMemo } from "react";
import Sidebar from "./components/Sidebar";
import OfficeView from "./components/OfficeView";
import Dashboard from "./components/Dashboard";
import TaskBoard from "./components/TaskBoard";
import SkillsLibrary from "./components/SkillsLibrary";
import SettingsPanel from "./components/SettingsPanel";
import DirectivesView from "./components/directives/DirectivesView";
import DeliverablesView from "./components/deliverables/DeliverablesView";
import { AppHeader } from "./components/AppHeader";
import { AppBanners } from "./components/AppBanners";
import { AppModals } from "./components/AppModals";
import type { DecisionInboxItem } from "./components/chat/decision-inbox";
import { useWebSocket } from "./hooks/useWebSocket";
import { useAppWebSocket } from "./hooks/useAppWebSocket";
import { useAppHandlers } from "./hooks/useAppHandlers";
import { useFetchAll } from "./hooks/useFetchAll";
import { computeAppLabels, computeUpdateBannerState } from "./hooks/useAppLabels";
import type {
  Department,
  Agent,
  Task,
  Message,
  CompanyStats,
  CompanySettings,
  CliStatusMap,
  SubTask,
  MeetingPresence,
} from "./types";
import { normalizeLanguage, pickLang, I18nProvider, detectBrowserLanguage } from "./i18n";
import type { TaskReportDetail } from "./api";
import * as api from "./api";
import { useTheme } from "./ThemeContext";
import {
  detectRuntimeOs,
  isForceUpdateBannerEnabled,
  mergeSettingsWithDefaults,
  UPDATE_BANNER_DISMISS_STORAGE_KEY,
} from "./appHelpers";
import type {
  SubAgent,
  CrossDeptDelivery,
  CeoOfficeCall,
  OAuthCallbackResult,
  View,
  TaskPanelTab,
  RuntimeOs,
} from "./appHelpers";

export type { CrossDeptDelivery, CeoOfficeCall, OAuthCallbackResult };

export default function App() {
  const { theme, toggleTheme } = useTheme();
  const [view, setView] = useState<View>("office");
  const [departments, setDepartments] = useState<Department[]>([]);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [stats, setStats] = useState<CompanyStats | null>(null);
  const [settings, setSettings] = useState<CompanySettings>(() =>
    mergeSettingsWithDefaults({ language: detectBrowserLanguage() }),
  );
  const [cliStatus, setCliStatus] = useState<CliStatusMap | null>(null);
  const [subAgents, setSubAgents] = useState<SubAgent[]>([]);
  const [subtasks, setSubtasks] = useState<SubTask[]>([]);
  const [selectedAgent, setSelectedAgent] = useState<Agent | null>(null);
  const [chatAgent, setChatAgent] = useState<Agent | null>(null);
  const [showChat, setShowChat] = useState(false);
  const [taskPanel, setTaskPanel] = useState<{ taskId: string; tab: TaskPanelTab } | null>(null);
  const [loading, setLoading] = useState(true);
  const [unreadAgentIds, setUnreadAgentIds] = useState<Set<string>>(new Set());
  const [crossDeptDeliveries, setCrossDeptDeliveries] = useState<CrossDeptDelivery[]>([]);
  const [ceoOfficeCalls, setCeoOfficeCalls] = useState<CeoOfficeCall[]>([]);
  const [meetingPresence, setMeetingPresence] = useState<MeetingPresence[]>([]);
  const [oauthResult, setOauthResult] = useState<OAuthCallbackResult | null>(null);
  const [taskReport, setTaskReport] = useState<TaskReportDetail | null>(null);
  const [showReportHistory, setShowReportHistory] = useState(false);
  const [showAgentStatus, setShowAgentStatus] = useState(false);
  const [showAgentManager, setShowAgentManager] = useState(false);
  /** 'team_leader_meeting' = 팀장들과의 채팅(전사 채팅 UI에 팀장만 초대된 컨텍스트) */
  const [chatContext, setChatContext] = useState<"announcement" | "team_leader_meeting" | null>(null);
  const [hireFromBreakRoom, setHireFromBreakRoom] = useState(false);
  const [showDecisionInbox, setShowDecisionInbox] = useState(false);
  const [decisionInboxLoading, setDecisionInboxLoading] = useState(false);
  const [decisionInboxItems, setDecisionInboxItems] = useState<DecisionInboxItem[]>([]);
  const [decisionReplyBusyKey, setDecisionReplyBusyKey] = useState<string | null>(null);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [mobileHeaderMenuOpen, setMobileHeaderMenuOpen] = useState(false);
  const [runtimeOs] = useState<RuntimeOs>(() => detectRuntimeOs());
  const [forceUpdateBanner] = useState<boolean>(() => isForceUpdateBannerEnabled());
  const [updateStatus, setUpdateStatus] = useState<api.UpdateStatus | null>(null);
  const [dismissedUpdateVersion, setDismissedUpdateVersion] = useState<string>(() =>
    typeof window !== "undefined" ? (window.localStorage.getItem(UPDATE_BANNER_DISMISS_STORAGE_KEY) ?? "") : "",
  );
  const [streamingMessage, setStreamingMessage] = useState<{
    message_id: string;
    agent_id: string;
    agent_name: string;
    agent_avatar: string;
    content: string;
  } | null>(null);

  const viewRef = useRef<View>("office");
  viewRef.current = view;
  const agentsRef = useRef<Agent[]>(agents);
  agentsRef.current = agents;
  const tasksRef = useRef<Task[]>(tasks);
  tasksRef.current = tasks;
  const subAgentsRef = useRef<SubAgent[]>(subAgents);
  subAgentsRef.current = subAgents;
  const codexThreadToSubAgentIdRef = useRef<Map<string, string>>(new Map());
  const codexThreadBindingTsRef = useRef<Map<string, number>>(new Map());
  const subAgentStreamTailRef = useRef<Map<string, string>>(new Map());
  const activeChatRef = useRef<{ showChat: boolean; agentId: string | null }>({ showChat: false, agentId: null });
  activeChatRef.current = { showChat, agentId: chatAgent?.id ?? null };
  const liveSyncInFlightRef = useRef(false);
  const liveSyncQueuedRef = useRef(false);
  const liveSyncTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const { connected, on } = useWebSocket();
  const { scheduleLiveSync } = useAppWebSocket({
    agentsRef,
    tasksRef,
    subAgentsRef,
    activeChatRef,
    viewRef,
    codexThreadToSubAgentIdRef,
    codexThreadBindingTsRef,
    subAgentStreamTailRef,
    liveSyncInFlightRef,
    liveSyncQueuedRef,
    liveSyncTimerRef,
    on,
    setAgents,
    setTasks,
    setStats,
    setSubAgents,
    setSubtasks,
    setMeetingPresence,
    setDecisionInboxItems,
    setMessages,
    setUnreadAgentIds,
    setCrossDeptDeliveries,
    setCeoOfficeCalls,
    setTaskReport,
    setStreamingMessage,
  });
  const fetchAll = useFetchAll(
    {
      setDepartments,
      setAgents,
      setTasks,
      setStats,
      setSettings,
      setSubtasks,
      setMeetingPresence,
      setDecisionInboxItems,
      setLoading,
    },
  );
  const handlers = useAppHandlers({
    agents,
    settings,
    setAgents,
    setTasks,
    setStats,
    setSettings,
    setMessages,
    setDecisionInboxItems,
    setDecisionInboxLoading,
    setDecisionReplyBusyKey,
    setShowChat,
    setChatAgent,
    setShowDecisionInbox,
    setUnreadAgentIds,
    scheduleLiveSync,
  });

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const op = params.get("oauth");
    const oe = params.get("oauth_error");
    if (op || oe) {
      setOauthResult({ provider: op, error: oe });
      const clean = new URL(window.location.href);
      clean.searchParams.delete("oauth");
      clean.searchParams.delete("oauth_error");
      window.history.replaceState({}, "", clean.pathname + clean.search);
      setView("settings");
    }
  }, []);
  // 세션(API 토큰) 부트스트랩 후 초기 데이터 로드 — 401 연쇄 방지
  useEffect(() => {
    api.bootstrapSession().finally(() => {
      fetchAll();
    });
  }, [fetchAll]);
  useEffect(() => {
    let cancelled = false;
    const refresh = () =>
      api
        .getUpdateStatus()
        .then((s) => {
          if (!cancelled) setUpdateStatus(s);
        })
        .catch(() => {});
    refresh();
    const t = setInterval(refresh, 30 * 60 * 1000);
    return () => {
      cancelled = true;
      clearInterval(t);
    };
  }, []);
  useEffect(() => {
    if (view === "settings" && !cliStatus) api.getCliStatus(true).then(setCliStatus).catch(console.error);
  }, [view, cliStatus]);
  useEffect(() => {
    setMobileNavOpen(false);
  }, [view]);
  useEffect(() => {
    const close = () => {
      if (window.innerWidth >= 1024) setMobileNavOpen(false);
    };
    window.addEventListener("resize", close);
    return () => window.removeEventListener("resize", close);
  }, []);
  useEffect(() => {
    if (view !== "office") return;
    api
      .getMeetingPresence()
      .then(setMeetingPresence)
      .catch(() => {});
  }, [view]);

  const activeMeetingTaskId = useMemo(() => {
    const now = Date.now();
    const counts = new Map<string, number>();
    for (const row of meetingPresence) {
      if (row.until < now || !row.task_id) continue;
      counts.set(row.task_id, (counts.get(row.task_id) ?? 0) + 1);
    }
    let picked: string | null = null;
    let maxCount = -1;
    for (const [tid, c] of counts.entries()) {
      if (c > maxCount) {
        maxCount = c;
        picked = tid;
      }
    }
    return picked;
  }, [meetingPresence]);

  const uiLanguage = normalizeLanguage(settings.language);
  const labels = computeAppLabels(uiLanguage);
  const bannerState = computeUpdateBannerState({
    uiLanguage,
    theme,
    runtimeOs,
    forceUpdateBanner,
    updateStatus,
    dismissedUpdateVersion,
    autoUpdateNoticePending: settings.autoUpdateNoticePending,
  });
  const openAnnouncementChat = useCallback(() => {
    setChatContext(null);
    setChatAgent(null);
    setShowChat(true);
    api.getMessages({ receiver_type: "all", limit: 50 }).then(setMessages).catch(console.error);
  }, []);
  /** 팀장들과의 채팅 — 팀장 전용 채널(receiver_type=team_leaders) 사용, 팀장만 답변 */
  const openTeamLeaderMeetingChat = useCallback(() => {
    setChatContext("team_leader_meeting");
    setChatAgent(null);
    setShowChat(true);
    api.getMessages({ receiver_type: "team_leaders", limit: 50 }).then(setMessages).catch(console.error);
  }, []);

  if (loading) {
    return (
      <I18nProvider language={uiLanguage}>
        <div className="h-screen flex items-center justify-center" style={{ background: "var(--th-bg-primary)" }}>
          <div className="text-center">
            <div
              className="mb-4 animate-agent-bounce flex items-center justify-center"
              style={{ color: "var(--th-text-secondary)" }}
            >
              <svg
                width="48"
                height="48"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M6 22V4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v18Z" />
                <path d="M6 12H4a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h2" />
                <path d="M18 9h2a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-2" />
                <path d="M10 6h4" />
                <path d="M10 10h4" />
                <path d="M10 14h4" />
                <path d="M10 18h4" />
              </svg>
            </div>
            <div className="text-lg font-medium" style={{ color: "var(--th-text-secondary)" }}>
              {labels.loadingTitle}
            </div>
            <div className="text-sm mt-1" style={{ color: "var(--th-text-muted)" }}>
              {labels.loadingSubtitle}
            </div>
          </div>
        </div>
      </I18nProvider>
    );
  }

  return (
    <I18nProvider language={uiLanguage}>
      <div className="app-shell flex h-[100dvh] min-h-[100dvh] overflow-hidden">
        <div className="hidden lg:flex lg:flex-shrink-0">
          <Sidebar
            currentView={view}
            onChangeView={setView}
            departments={departments}
            agents={agents}
            settings={settings}
            connected={connected}
          />
        </div>
        {mobileNavOpen && (
          <button
            aria-label="Close navigation"
            className="fixed inset-0 z-40 bg-black/50 lg:hidden"
            onClick={() => setMobileNavOpen(false)}
          />
        )}
        <div
          className={`fixed inset-y-0 left-0 z-50 transition-transform duration-200 lg:hidden ${mobileNavOpen ? "translate-x-0" : "-translate-x-full pointer-events-none"}`}
        >
          <Sidebar
            currentView={view}
            onChangeView={(v) => {
              setView(v);
              setMobileNavOpen(false);
            }}
            departments={departments}
            agents={agents}
            settings={settings}
            connected={connected}
          />
        </div>

        <main className="flex-1 overflow-y-auto overflow-x-hidden min-w-0">
          <AppHeader
            viewTitle={labels.viewTitles[view] ?? ""}
            tasksPrimaryLabel={labels.tasksPrimaryLabel}
            decisionLabel={labels.decisionLabel}
            agentStatusLabel={labels.agentStatusLabel}
            agentManagerLabel={labels.agentManagerLabel}
            reportLabel={labels.reportLabel}
            announcementLabel={labels.announcementLabel}
            decisionInboxItems={decisionInboxItems}
            decisionInboxLoading={decisionInboxLoading}
            theme={theme}
            connected={connected}
            mobileHeaderMenuOpen={mobileHeaderMenuOpen}
            onOpenMobileNav={() => setMobileNavOpen(true)}
            onNavigateTasks={() => setView("tasks")}
            onOpenDecisionInbox={handlers.handleOpenDecisionInbox}
            onOpenAgentStatus={() => setShowAgentStatus(true)}
            onOpenReportHistory={() => setShowReportHistory(true)}
            onOpenAnnouncement={openAnnouncementChat}
            onOpenAgentManager={() => setShowAgentManager(true)}
            onToggleTheme={toggleTheme}
            onToggleMobileHeaderMenu={() => setMobileHeaderMenuOpen((v) => !v)}
            onCloseMobileHeaderMenu={() => setMobileHeaderMenuOpen(false)}
          />
          <AppBanners
            {...bannerState}
            onDismissAutoUpdateNotice={() => {
              void handlers.handleDismissAutoUpdateNotice();
            }}
            onDismissUpdateBanner={(v) => setDismissedUpdateVersion(v)}
          />
          <div className="p-3 sm:p-4 lg:p-6">
            {view === "directives" && (
              <DirectivesView
                tasks={tasks}
                agents={agents}
                departments={departments}
                subtasks={subtasks}
                onCreateTask={handlers.handleCreateTask}
                onUpdateTask={handlers.handleUpdateTask}
                onDeleteTask={handlers.handleDeleteTask}
                onAssignTask={handlers.handleAssignTask}
                onRunTask={handlers.handleRunTask}
                onStopTask={handlers.handleStopTask}
                onPauseTask={handlers.handlePauseTask}
                onResumeTask={handlers.handleResumeTask}
                onOpenTerminal={(id) => setTaskPanel({ taskId: id, tab: "terminal" })}
                onOpenMeetingMinutes={(id) => setTaskPanel({ taskId: id, tab: "minutes" })}
                onViewDeliverable={() => setView("deliverables")}
              />
            )}
            {view === "office" && (
              <OfficeView
                departments={departments}
                agents={agents}
                tasks={tasks}
                subAgents={subAgents}
                meetingPresence={meetingPresence}
                activeMeetingTaskId={activeMeetingTaskId}
                unreadAgentIds={unreadAgentIds}
                crossDeptDeliveries={crossDeptDeliveries}
                onCrossDeptDeliveryProcessed={(id) => setCrossDeptDeliveries((prev) => prev.filter((d) => d.id !== id))}
                ceoOfficeCalls={ceoOfficeCalls}
                onCeoOfficeCallProcessed={(id) => setCeoOfficeCalls((prev) => prev.filter((d) => d.id !== id))}
                onOpenActiveMeetingMinutes={(taskId) => setTaskPanel({ taskId, tab: "minutes" })}
                onSelectAgent={(a) => setSelectedAgent(a)}
                onSelectDepartment={(dept) => {
                  const leader = agents.find((a) => a.department_id === dept.id && a.role === "team_leader");
                  if (leader) handlers.handleOpenChat(leader);
                }}
                onHireAgent={() => {
                  setShowAgentManager(true);
                  setHireFromBreakRoom(true);
                }}
                onConveneTeamLeaderMeeting={openTeamLeaderMeetingChat}
                onOpenAgentManager={() => setShowAgentManager(true)}
                onMoveAgent={async (agentId, targetDeptId) => {
                  await api.updateAgent(agentId, { department_id: targetDeptId });
                }}
              />
            )}
            {view === "dashboard" && (
              <Dashboard
                stats={stats}
                agents={agents}
                tasks={tasks}
                companyName={settings.companyName}
                onPrimaryCtaClick={() => setView("tasks")}
                onSelectDepartment={() => setView("office")}
                onNavigateToBreakRoom={() => setView("office")}
                onOpenAgentManager={() => setShowAgentManager(true)}
              />
            )}
            {view === "tasks" && (
              <TaskBoard
                tasks={tasks}
                agents={agents}
                departments={departments}
                subtasks={subtasks}
                onCreateTask={handlers.handleCreateTask}
                onUpdateTask={handlers.handleUpdateTask}
                onDeleteTask={handlers.handleDeleteTask}
                onAssignTask={handlers.handleAssignTask}
                onRunTask={handlers.handleRunTask}
                onStopTask={handlers.handleStopTask}
                onPauseTask={handlers.handlePauseTask}
                onResumeTask={handlers.handleResumeTask}
                onOpenTerminal={(id) => setTaskPanel({ taskId: id, tab: "terminal" })}
                onOpenMeetingMinutes={(id) => setTaskPanel({ taskId: id, tab: "minutes" })}
              />
            )}
            {view === "deliverables" && (
              <DeliverablesView
                tasks={tasks}
                agents={agents}
                departments={departments}
                onDeleteTask={handlers.handleDeleteTask}
                onNavigateToDirectives={() => setView("directives")}
              />
            )}
            {view === "skills" && <SkillsLibrary agents={agents} />}
            {view === "settings" && (
              <SettingsPanel
                settings={settings}
                cliStatus={cliStatus}
                onSave={handlers.handleSaveSettings}
                onRefreshCli={() => api.getCliStatus(true).then(setCliStatus).catch(console.error)}
                oauthResult={oauthResult}
                onOauthResultClear={() => setOauthResult(null)}
              />
            )}
          </div>
        </main>

        <AppModals
          showChat={showChat}
          chatAgent={chatAgent}
          chatContext={chatContext}
          messages={messages}
          agents={agents}
          streamingMessage={streamingMessage}
          handleSendMessage={handlers.handleSendMessage}
          handleSendAnnouncement={handlers.handleSendAnnouncement}
          handleSendTeamLeaderAnnouncement={handlers.handleSendTeamLeaderAnnouncement}
          handleSendDirective={handlers.handleSendDirective}
          setMessages={setMessages}
          setShowChat={(v) => {
            if (!v) setChatContext(null);
            setShowChat(v);
          }}
          showDecisionInbox={showDecisionInbox}
          decisionInboxLoading={decisionInboxLoading}
          decisionInboxItems={decisionInboxItems}
          decisionReplyBusyKey={decisionReplyBusyKey}
          uiLanguage={uiLanguage}
          setShowDecisionInbox={setShowDecisionInbox}
          loadDecisionInbox={handlers.loadDecisionInbox}
          handleReplyDecisionOption={handlers.handleReplyDecisionOption}
          handleOpenDecisionChat={handlers.handleOpenDecisionChat}
          selectedAgent={selectedAgent}
          departments={departments}
          tasks={tasks}
          subAgents={subAgents}
          subtasks={subtasks}
          setSelectedAgent={setSelectedAgent}
          handleOpenChat={handlers.handleOpenChat}
          setView={setView}
          setAgents={setAgents}
          setTaskPanel={setTaskPanel}
          taskPanel={taskPanel}
          taskReport={taskReport}
          setTaskReport={setTaskReport}
          showReportHistory={showReportHistory}
          setShowReportHistory={setShowReportHistory}
          showAgentStatus={showAgentStatus}
          setShowAgentStatus={setShowAgentStatus}
          showAgentManager={showAgentManager}
          setShowAgentManager={setShowAgentManager}
          hireFromBreakRoom={hireFromBreakRoom}
          onConsumedHireFromBreakRoom={() => setHireFromBreakRoom(false)}
        />
      </div>
    </I18nProvider>
  );
}
