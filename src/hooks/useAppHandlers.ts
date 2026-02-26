import { useCallback } from "react";
import * as api from "../api";
import type { Agent, Task, CompanySettings, Message } from "../types";
import { normalizeLanguage, pickLang, LANGUAGE_USER_SET_STORAGE_KEY } from "../i18n";
import { buildDecisionInboxItems } from "../components/chat/decision-inbox";
import type { DecisionInboxItem } from "../components/chat/decision-inbox";
import { mergeSettingsWithDefaults, syncClientLanguage } from "../appHelpers";

type ProjectMetaPayload = {
  project_id?: string;
  project_path?: string;
  project_context?: string;
};

export type UseAppHandlersParams = {
  agents: Agent[];
  settings: CompanySettings;
  setAgents: React.Dispatch<React.SetStateAction<Agent[]>>;
  setTasks: React.Dispatch<React.SetStateAction<Task[]>>;
  setStats: React.Dispatch<React.SetStateAction<import("../types").CompanyStats | null>>;
  setSettings: React.Dispatch<React.SetStateAction<CompanySettings>>;
  setMessages: React.Dispatch<React.SetStateAction<Message[]>>;
  setDecisionInboxItems: React.Dispatch<React.SetStateAction<DecisionInboxItem[]>>;
  setDecisionInboxLoading: React.Dispatch<React.SetStateAction<boolean>>;
  setDecisionReplyBusyKey: React.Dispatch<React.SetStateAction<string | null>>;
  setShowChat: React.Dispatch<React.SetStateAction<boolean>>;
  setChatAgent: React.Dispatch<React.SetStateAction<Agent | null>>;
  setShowDecisionInbox: React.Dispatch<React.SetStateAction<boolean>>;
  setUnreadAgentIds: React.Dispatch<React.SetStateAction<Set<string>>>;
  scheduleLiveSync: (delayMs?: number) => void;
};

export function useAppHandlers(params: UseAppHandlersParams) {
  const {
    agents, settings, setAgents, setTasks, setStats, setSettings,
    setMessages, setDecisionInboxItems, setDecisionInboxLoading,
    setDecisionReplyBusyKey, setShowChat, setChatAgent, setShowDecisionInbox,
    setUnreadAgentIds, scheduleLiveSync,
  } = params;

  const handleSendMessage = useCallback(async (
    content: string,
    receiverType: "agent" | "department" | "all",
    receiverId?: string,
    messageType?: string,
    projectMeta?: ProjectMetaPayload,
  ) => {
    try {
      await api.sendMessage({
        receiver_type: receiverType, receiver_id: receiverId, content,
        message_type: (messageType as "chat" | "task_assign" | "report") || "chat",
        project_id: projectMeta?.project_id, project_path: projectMeta?.project_path,
        project_context: projectMeta?.project_context,
      });
      const msgs = await api.getMessages({ receiver_type: receiverType, receiver_id: receiverId, limit: 50 });
      setMessages(msgs);
    } catch (e) { console.error("Send message failed:", e); }
  }, [setMessages]);

  const handleSendAnnouncement = useCallback(async (content: string) => {
    try { await api.sendAnnouncement(content); }
    catch (e) { console.error("Announcement failed:", e); }
  }, []);

  /** 팀장 회의 전용: 팀장 전용 채널로 전송 후 메시지 목록 갱신 */
  const handleSendTeamLeaderAnnouncement = useCallback(async (content: string) => {
    try {
      await api.sendAnnouncementToTeamLeaders(content);
      const msgs = await api.getMessages({ receiver_type: "team_leaders", limit: 50 });
      setMessages(msgs);
    } catch (e) { console.error("Team leader announcement failed:", e); }
  }, [setMessages]);

  const handleSendDirective = useCallback(async (content: string, projectMeta?: ProjectMetaPayload) => {
    try {
      if (projectMeta?.project_id || projectMeta?.project_path || projectMeta?.project_context) {
        await api.sendDirectiveWithProject({
          content, project_id: projectMeta.project_id,
          project_path: projectMeta.project_path, project_context: projectMeta.project_context,
        });
      } else {
        await api.sendDirective(content);
      }
    } catch (e) { console.error("Directive failed:", e); }
  }, []);

  const handleCreateTask = useCallback(async (input: {
    title: string; description?: string; department_id?: string;
    task_type?: string; priority?: number; project_id?: string;
    project_path?: string; assigned_agent_id?: string;
  }) => {
    try {
      await api.createTask(input as Parameters<typeof api.createTask>[0]);
      const [tks, sts] = await Promise.all([api.getTasks(), api.getStats()]);
      setTasks(tks); setStats(sts);
    } catch (e) { console.error("Create task failed:", e); }
  }, [setTasks, setStats]);

  const handleUpdateTask = useCallback(async (id: string, data: Partial<Task>) => {
    try { await api.updateTask(id, data); setTasks(await api.getTasks()); }
    catch (e) { console.error("Update task failed:", e); }
  }, [setTasks]);

  const handleDeleteTask = useCallback(async (id: string) => {
    try { await api.deleteTask(id); setTasks((prev) => prev.filter((t) => t.id !== id)); }
    catch (e) { console.error("Delete task failed:", e); }
  }, [setTasks]);

  const handleAssignTask = useCallback(async (taskId: string, agentId: string) => {
    try {
      await api.assignTask(taskId, agentId);
      const [tks, ags] = await Promise.all([api.getTasks(), api.getAgents()]);
      setTasks(tks); setAgents(ags);
    } catch (e) { console.error("Assign task failed:", e); }
  }, [setTasks, setAgents]);

  const handleRunTask = useCallback(async (id: string, executionMode?: string) => {
    try {
      await api.runTask(id, executionMode ? { execution_mode: executionMode } : undefined);
      const [tks, ags] = await Promise.all([api.getTasks(), api.getAgents()]);
      setTasks(tks); setAgents(ags);
    } catch (e) { console.error("Run task failed:", e); }
  }, [setTasks, setAgents]);

  const handleStopTask = useCallback(async (id: string) => {
    try {
      await api.stopTask(id);
      const [tks, ags] = await Promise.all([api.getTasks(), api.getAgents()]);
      setTasks(tks); setAgents(ags);
    } catch (e) { console.error("Stop task failed:", e); }
  }, [setTasks, setAgents]);

  const handlePauseTask = useCallback(async (id: string) => {
    try {
      await api.pauseTask(id);
      const [tks, ags] = await Promise.all([api.getTasks(), api.getAgents()]);
      setTasks(tks); setAgents(ags);
    } catch (e) { console.error("Pause task failed:", e); }
  }, [setTasks, setAgents]);

  const handleResumeTask = useCallback(async (id: string) => {
    try {
      await api.resumeTask(id);
      const [tks, ags] = await Promise.all([api.getTasks(), api.getAgents()]);
      setTasks(tks); setAgents(ags);
    } catch (e) { console.error("Resume task failed:", e); }
  }, [setTasks, setAgents]);

  const handleSaveSettings = useCallback(async (s: CompanySettings) => {
    try {
      const next = mergeSettingsWithDefaults(s);
      const autoUpdateChanged = Boolean(next.autoUpdateEnabled) !== Boolean(settings.autoUpdateEnabled);
      await api.saveSettings(next);
      if (autoUpdateChanged) {
        try { await api.setAutoUpdateEnabled(Boolean(next.autoUpdateEnabled)); }
        catch (e) { console.error("Auto update runtime sync failed:", e); }
      }
      setSettings(next);
      if (typeof window !== "undefined") window.localStorage.setItem(LANGUAGE_USER_SET_STORAGE_KEY, "1");
      syncClientLanguage(next.language);
    } catch (e) { console.error("Save settings failed:", e); }
  }, [settings.autoUpdateEnabled, setSettings]);

  const handleDismissAutoUpdateNotice = useCallback(async () => {
    if (!settings.autoUpdateNoticePending) return;
    setSettings((prev) => ({ ...prev, autoUpdateNoticePending: false }));
    try { await api.saveSettingsPatch({ autoUpdateNoticePending: false }); }
    catch (e) { console.error("Failed to persist auto-update notice dismissal:", e); }
  }, [settings.autoUpdateNoticePending, setSettings]);

  const handleOpenChat = useCallback((agent: Agent) => {
    setChatAgent(agent); setShowChat(true);
    setUnreadAgentIds((prev) => {
      if (!prev.has(agent.id)) return prev;
      const next = new Set(prev); next.delete(agent.id); return next;
    });
    api.getMessages({ receiver_type: "agent", receiver_id: agent.id, limit: 50 })
      .then(setMessages).catch(console.error);
  }, [setChatAgent, setShowChat, setUnreadAgentIds, setMessages]);

  const mapWorkflowDecisionItems = useCallback((items: api.DecisionInboxRouteItem[]): DecisionInboxItem[] => {
    const locale = normalizeLanguage(settings.language);
    const optLabel = (kind: DecisionInboxItem["kind"], action: string, number: number): string => {
      if (kind === "project_review_ready") {
        if (action === "start_project_review") return pickLang(locale, { ko: "팀장 회의 진행", en: "Start Team-Lead Meeting" });
        if (action === "keep_waiting") return pickLang(locale, { ko: "대기 유지", en: "Keep Waiting" });
        if (action === "add_followup_request") return pickLang(locale, { ko: "추가요청 입력", en: "Add Follow-up Request" });
      }
      if (kind === "task_timeout_resume") {
        if (action === "resume_timeout_task") return pickLang(locale, { ko: "이어서 진행 (재개)", en: "Resume Task" });
        if (action === "keep_inbox") return pickLang(locale, { ko: "Inbox 유지", en: "Keep in Inbox" });
      }
      if (kind === "review_round_pick" && action === "skip_to_next_round")
        return pickLang(locale, { ko: "다음 라운드로 SKIP", en: "Skip to Next Round" });
      return `${number}. ${action}`;
    };
    return items.map((item) => ({
      id: item.id, kind: item.kind, agentId: item.agent_id ?? null,
      agentName: item.agent_name || (item.kind === "project_review_ready"
        ? (item.project_name || item.project_id || "Planning Lead")
        : (item.task_title || item.task_id || "Task")),
      agentNameKo: item.agent_name_ko || item.agent_name || (item.kind === "project_review_ready"
        ? (item.project_name || item.project_id || "기획팀장")
        : (item.task_title || item.task_id || "작업")),
      agentAvatar: item.agent_avatar ?? ((item.kind === "project_review_ready" || item.kind === "review_round_pick") ? "user" : null),
      requestContent: item.summary,
      options: item.options.map((o) => ({ number: o.number, label: o.label ?? optLabel(item.kind, o.action, o.number), action: o.action })),
      createdAt: item.created_at, taskId: item.task_id, projectId: item.project_id, projectName: item.project_name,
    }));
  }, [settings.language]);

  const loadDecisionInbox = useCallback(async () => {
    setDecisionInboxLoading(true);
    try {
      const [allMessages, workflowDecisionItems] = await Promise.all([
        api.getMessages({ limit: 500 }), api.getDecisionInbox(),
      ]);
      const agentDecisionItems = buildDecisionInboxItems(allMessages, agents);
      const workflowItems = mapWorkflowDecisionItems(workflowDecisionItems);
      const merged = [...workflowItems, ...agentDecisionItems];
      const deduped = new Map<string, DecisionInboxItem>();
      for (const item of merged) deduped.set(item.id, item);
      setDecisionInboxItems(Array.from(deduped.values()).sort((a, b) => b.createdAt - a.createdAt));
    } catch (e) { console.error("Load decision inbox failed:", e); }
    finally { setDecisionInboxLoading(false); }
  }, [agents, mapWorkflowDecisionItems, setDecisionInboxItems, setDecisionInboxLoading]);

  const handleOpenDecisionInbox = useCallback(() => {
    setShowDecisionInbox(true); void loadDecisionInbox();
  }, [loadDecisionInbox, setShowDecisionInbox]);

  const handleOpenDecisionChat = useCallback((agentId: string) => {
    const matched = agents.find((a) => a.id === agentId);
    if (!matched) {
      window.alert(pickLang(normalizeLanguage(settings.language), {
        ko: "요청 에이전트 정보를 찾지 못했습니다.", en: "Could not find the requested agent.",
}));
      return;
    }
    setShowDecisionInbox(false); handleOpenChat(matched);
  }, [agents, settings.language, setShowDecisionInbox, handleOpenChat]);

  const handleReplyDecisionOption = useCallback(async (
    item: DecisionInboxItem,
    optionNumber: number,
    payloadInput?: { note?: string; selected_option_numbers?: number[] },
  ) => {
    const option = item.options.find((e) => e.number === optionNumber);
    if (!option) return;
    const busyKey = `${item.id}:${option.number}`;
    setDecisionReplyBusyKey(busyKey);
    const locale = normalizeLanguage(settings.language);
    try {
      if (item.kind === "agent_request") {
        if (!item.agentId) return;
        const replyContent = pickLang(locale, {
          ko: `[의사결정 회신] ${option.number}번으로 진행해 주세요. (${option.label})`,
          en: `[Decision Reply] Please proceed with option ${option.number}. (${option.label})`,
          ja: `[意思決定返信] ${option.number}番で進めてください。(${option.label})`,
          zh: `[决策回复] 请按选项 ${option.number} 推进。（${option.label}）`,
        });
        await api.sendMessage({ receiver_type: "agent", receiver_id: item.agentId, content: replyContent, message_type: "chat", task_id: item.taskId ?? undefined });
        setDecisionInboxItems((prev) => prev.filter((e) => e.id !== item.id));
      } else {
        const selectedAction = option.action ?? "";
        let payload: { note?: string; target_task_id?: string; selected_option_numbers?: number[] } | undefined;
        if (selectedAction === "add_followup_request") {
          const note = payloadInput?.note?.trim() ?? "";
          if (!note) {
            window.alert(pickLang(locale, { ko: "추가요청사항이 비어 있습니다.", en: "Additional request is empty." }));
            return;
          }
          payload = { note, ...(item.taskId ? { target_task_id: item.taskId } : {}) };
        } else if (item.kind === "review_round_pick") {
          const note = payloadInput?.note?.trim() ?? "";
          const sel = payloadInput?.selected_option_numbers;
          payload = { ...(note ? { note } : {}), ...(Array.isArray(sel) ? { selected_option_numbers: sel } : {}) };
        }
        const result = await api.replyDecisionInbox(item.id, optionNumber, payload);
        if (result.resolved) { setDecisionInboxItems((prev) => prev.filter((e) => e.id !== item.id)); scheduleLiveSync(40); }
        await loadDecisionInbox();
      }
    } catch (error) {
      console.error("Decision reply failed:", error);
      window.alert(pickLang(locale, {
        ko: "의사결정 회신 전송에 실패했습니다. 잠시 후 다시 시도해 주세요.",
        en: "Failed to send decision reply. Please try again.",
}));
    } finally {
      setDecisionReplyBusyKey((prev) => (prev === busyKey ? null : prev));
    }
  }, [settings.language, loadDecisionInbox, setDecisionInboxItems, setDecisionReplyBusyKey, scheduleLiveSync]);

  return {
    handleSendMessage, handleSendAnnouncement, handleSendTeamLeaderAnnouncement, handleSendDirective,
    handleCreateTask, handleUpdateTask, handleDeleteTask,
    handleAssignTask, handleRunTask, handleStopTask, handlePauseTask, handleResumeTask,
    handleSaveSettings, handleDismissAutoUpdateNotice,
    handleOpenChat, handleOpenDecisionInbox, handleOpenDecisionChat,
    handleReplyDecisionOption, loadDecisionInbox,
  };
}
