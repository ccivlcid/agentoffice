import { useState, useMemo, useEffect } from "react";
import type { Agent, Task, Department, SubTask } from "../types";
import * as api from "../api";
import type { OAuthStatus } from "../api";
import AgentAvatar from "./AgentAvatar";
import {
  useI18n,
  roleLabel,
  statusLabel,
  STATUS_CONFIG,
} from "./agent-detail/agentDetailHelpers";
import AgentDetailCliEditor from "./agent-detail/AgentDetailCliEditor";
import AgentDetailTasks from "./agent-detail/AgentDetailTasks";
import AgentDetailInfo from "./agent-detail/AgentDetailInfo";
import AgentDetailAlba from "./agent-detail/AgentDetailAlba";
import { X } from "lucide-react";

interface SubAgent {
  id: string;
  parentAgentId: string;
  task: string;
  status: "working" | "done";
}

interface AgentDetailProps {
  agent: Agent;
  agents: Agent[];
  department: Department | undefined;
  departments: Department[];
  tasks: Task[];
  subAgents: SubAgent[];
  subtasks: SubTask[];
  onClose: () => void;
  onChat: (agent: Agent) => void;
  onAssignTask: (agentId: string) => void;
  onOpenTerminal?: (taskId: string) => void;
  onAgentUpdated?: () => void;
}

export default function AgentDetail({
  agent,
  agents,
  department,
  departments,
  tasks,
  subAgents,
  subtasks,
  onClose,
  onChat,
  onAssignTask,
  onOpenTerminal,
  onAgentUpdated,
}: AgentDetailProps) {
  const { t, locale } = useI18n();
  const [tab, setTab] = useState<"info" | "tasks" | "alba">("info");
  const [editingCli, setEditingCli] = useState(false);
  const [selectedCli, setSelectedCli] = useState(agent.cli_provider);
  const [selectedOAuthAccountId, setSelectedOAuthAccountId] = useState(agent.oauth_account_id ?? "");
  const [selectedApiProviderId, setSelectedApiProviderId] = useState(agent.api_provider_id ?? "");
  const [selectedApiModel, setSelectedApiModel] = useState(agent.api_model ?? "");
  const [savingCli, setSavingCli] = useState(false);
  const [oauthStatus, setOauthStatus] = useState<OAuthStatus | null>(null);
  const [oauthLoading, setOauthLoading] = useState(false);
  const [expandedTaskId, setExpandedTaskId] = useState<string | null>(null);

  const agentTasks = tasks.filter((t) => t.assigned_agent_id === agent.id);
  const subtasksByTask = useMemo(() => {
    const map: Record<string, SubTask[]> = {};
    for (const st of subtasks) {
      if (!map[st.task_id]) map[st.task_id] = [];
      map[st.task_id].push(st);
    }
    return map;
  }, [subtasks]);
  const agentSubAgents = subAgents.filter((s) => s.parentAgentId === agent.id);
  const statusCfg = STATUS_CONFIG[agent.status] ?? STATUS_CONFIG.idle;
  const oauthProviderKey =
    selectedCli === "copilot" ? "github-copilot" : selectedCli === "antigravity" ? "antigravity" : null;
  const activeOAuthAccounts = useMemo(() => {
    if (!oauthProviderKey || !oauthStatus) return [];
    return (oauthStatus.providers[oauthProviderKey]?.accounts ?? []).filter(
      (a) => a.active && a.status === "active",
    );
  }, [oauthProviderKey, oauthStatus]);
  const requiresOAuthAccount = selectedCli === "copilot" || selectedCli === "antigravity";
  const requiresApiProvider = selectedCli === "api";
  const canSaveCli = requiresApiProvider
    ? false
    : (!requiresOAuthAccount || Boolean(selectedOAuthAccountId));

  const xpLevel = Math.floor(agent.stats_xp / 100) + 1;
  const xpProgress = agent.stats_xp % 100;

  useEffect(() => {
    setSelectedCli(agent.cli_provider);
    setSelectedOAuthAccountId(agent.oauth_account_id ?? "");
    setSelectedApiProviderId(agent.api_provider_id ?? "");
    setSelectedApiModel(agent.api_model ?? "");
  }, [agent.id, agent.cli_provider, agent.oauth_account_id, agent.api_provider_id, agent.api_model]);

  useEffect(() => {
    if (!editingCli || !requiresOAuthAccount) return;
    setOauthLoading(true);
    api.getOAuthStatus()
      .then(setOauthStatus)
      .catch((err) => console.error("Failed to load OAuth status:", err))
      .finally(() => setOauthLoading(false));
  }, [editingCli, requiresOAuthAccount]);

  useEffect(() => {
    if (!requiresOAuthAccount) {
      if (selectedOAuthAccountId) setSelectedOAuthAccountId("");
      return;
    }
    if (activeOAuthAccounts.length === 0) return;
    if (!selectedOAuthAccountId || !activeOAuthAccounts.some((a) => a.id === selectedOAuthAccountId)) {
      setSelectedOAuthAccountId(activeOAuthAccounts[0].id);
    }
  }, [requiresOAuthAccount, activeOAuthAccounts, selectedOAuthAccountId]);

  const handleCliSave = async () => {
    setSavingCli(true);
    try {
      await api.updateAgent(agent.id, {
        cli_provider: selectedCli,
        oauth_account_id: requiresOAuthAccount ? (selectedOAuthAccountId || null) : null,
        api_provider_id: requiresApiProvider ? (selectedApiProviderId || null) : null,
        api_model: requiresApiProvider ? (selectedApiModel || null) : null,
      });
      onAgentUpdated?.();
      setEditingCli(false);
    } catch (e) {
      console.error("Failed to update CLI:", e);
    } finally {
      setSavingCli(false);
    }
  };

  const handleCliCancel = () => {
    setEditingCli(false);
    setSelectedCli(agent.cli_provider);
    setSelectedOAuthAccountId(agent.oauth_account_id ?? "");
    setSelectedApiProviderId(agent.api_provider_id ?? "");
    setSelectedApiModel(agent.api_model ?? "");
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="w-[calc(100vw-1.5rem)] max-w-[480px] max-h-[85vh] overflow-hidden rounded-2xl border border-slate-700 bg-slate-800 shadow-2xl">
        {/* Header */}
        <div
          className="relative px-6 py-5 border-b border-slate-700"
          style={{
            background: department
              ? `linear-gradient(135deg, ${department.color}22, transparent)`
              : undefined,
          }}
        >
          <button
            onClick={onClose}
            className="absolute top-3 right-3 w-8 h-8 rounded-full bg-slate-700/50 hover:bg-slate-600 flex items-center justify-center text-slate-400 hover:text-white transition-colors"
          >
            <X width={18} height={18} aria-hidden />
          </button>
          <div className="flex items-center gap-4">
            <div className="relative">
              <AgentAvatar
                agent={agent}
                agents={agents}
                size={64}
                rounded="2xl"
                className={agent.status === "working" ? "animate-agent-work" : ""}
              />
              <div
                className={`absolute -bottom-1 -right-1 w-4 h-4 rounded-full border-2 border-slate-800 ${
                  agent.status === "working" ? "bg-blue-500"
                  : agent.status === "idle" ? "bg-green-500"
                  : agent.status === "break" ? "bg-yellow-500"
                  : "bg-slate-500"
                }`}
              />
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-white">
                  {locale === "ko" ? agent.name_ko ?? agent.name : agent.name ?? agent.name_ko}
                </h2>
                <span className={`text-xs px-1.5 py-0.5 rounded ${statusCfg.bg} ${statusCfg.color}`}>
                  {statusLabel(statusCfg.label, t)}
                </span>
              </div>
              <div className="text-sm text-slate-400 mt-0.5">
                {department?.icon} {department ? (locale === "ko" ? department.name_ko : department.name) : ""} ·{" "}
                {roleLabel(agent.role, t)}
              </div>
              <div className="text-xs text-slate-500 mt-0.5 flex items-center gap-1">
                <AgentDetailCliEditor
                  agent={agent}
                  editingCli={editingCli}
                  selectedCli={selectedCli}
                  selectedOAuthAccountId={selectedOAuthAccountId}
                  requiresOAuthAccount={requiresOAuthAccount}
                  requiresApiProvider={requiresApiProvider}
                  canSaveCli={canSaveCli}
                  savingCli={savingCli}
                  oauthLoading={oauthLoading}
                  activeOAuthAccounts={activeOAuthAccounts}
                  t={t}
                  onCliChange={setSelectedCli}
                  onOAuthAccountChange={setSelectedOAuthAccountId}
                  onSave={() => void handleCliSave()}
                  onCancel={handleCliCancel}
                  onStartEdit={() => setEditingCli(true)}
                />
              </div>
            </div>
          </div>
          {/* Level bar */}
          <div className="mt-3 flex items-center gap-2">
            <span className="text-xs text-yellow-400 font-bold">Lv.{xpLevel}</span>
            <div className="flex-1 h-1.5 bg-slate-700 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-yellow-500 to-amber-400 rounded-full transition-all"
                style={{ width: `${xpProgress}%` }}
              />
            </div>
            <span className="text-[10px] text-slate-500">{agent.stats_xp} XP</span>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-slate-700">
          {[
            { key: "info", label: t({ ko: "정보", en: "Info" }) },
            { key: "tasks", label: `${t({ ko: "업무", en: "Tasks" })} (${agentTasks.length})` },
            { key: "alba", label: `${t({ ko: "알바생", en: "Sub-agents" })} (${agentSubAgents.length})` },
          ].map((tabItem) => (
            <button
              key={tabItem.key}
              onClick={() => setTab(tabItem.key as typeof tab)}
              className={`flex-1 py-2.5 text-sm font-medium transition-colors ${
                tab === tabItem.key
                  ? "text-blue-400 border-b-2 border-blue-400"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              {tabItem.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="p-4 overflow-y-auto max-h-[40vh]">
          {tab === "info" && (
            <AgentDetailInfo
              agent={agent}
              xpLevel={xpLevel}
              agentSubAgents={agentSubAgents}
              t={t}
              onChat={onChat}
              onAssignTask={onAssignTask}
              onOpenTerminal={onOpenTerminal}
            />
          )}
          {tab === "tasks" && (
            <AgentDetailTasks
              agentTasks={agentTasks}
              subtasksByTask={subtasksByTask}
              departments={departments}
              locale={locale}
              expandedTaskId={expandedTaskId}
              onExpandToggle={(taskId) => setExpandedTaskId(expandedTaskId === taskId ? null : taskId)}
              t={t}
            />
          )}
          {tab === "alba" && (
            <AgentDetailAlba agentSubAgents={agentSubAgents} t={t} />
          )}
        </div>
      </div>
    </div>
  );
}
