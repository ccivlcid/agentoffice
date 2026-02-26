import { ChatPanel } from "./ChatPanel";
import DecisionInboxModal from "./DecisionInboxModal";
import AgentDetail from "./AgentDetail";
import TerminalPanel from "./TerminalPanel";
import TaskReportPopup from "./TaskReportPopup";
import ReportHistory from "./ReportHistory";
import AgentStatusPanel from "./AgentStatusPanel";
import AgentManagerModal from "./AgentManagerModal";
import type { Agent, Department, Task, SubTask, Message } from "../types";
import type { DecisionInboxItem } from "./chat/decision-inbox";
import type { SubAgent, CrossDeptDelivery, CeoOfficeCall, TaskPanelTab } from "../appHelpers";
import type { TaskReportDetail } from "../api";
import type { UiLanguage } from "../i18n";
import * as api from "../api";

export type AppModalsProps = {
  showChat: boolean;
  chatAgent: Agent | null;
  /** 'team_leader_meeting' = 팀장들과의 채팅(전사 채팅에서 팀장만 초대) */
  chatContext?: 'announcement' | 'team_leader_meeting' | null;
  messages: Message[];
  agents: Agent[];
  streamingMessage: { message_id: string; agent_id: string; agent_name: string; agent_avatar: string; content: string } | null;
  handleSendMessage: (...args: Parameters<React.ComponentProps<typeof ChatPanel>["onSendMessage"]>) => Promise<void>;
  handleSendAnnouncement: (content: string) => Promise<void>;
  handleSendTeamLeaderAnnouncement?: (content: string) => Promise<void>;
  handleSendDirective: (content: string, meta?: { project_id?: string; project_path?: string; project_context?: string }) => Promise<void>;
  setMessages: React.Dispatch<React.SetStateAction<Message[]>>;
  setShowChat: (v: boolean) => void;

  showDecisionInbox: boolean;
  decisionInboxLoading: boolean;
  decisionInboxItems: DecisionInboxItem[];
  decisionReplyBusyKey: string | null;
  uiLanguage: UiLanguage;
  setShowDecisionInbox: (v: boolean) => void;
  loadDecisionInbox: () => Promise<void>;
  handleReplyDecisionOption: (...args: Parameters<React.ComponentProps<typeof DecisionInboxModal>["onReplyOption"]>) => Promise<void>;
  handleOpenDecisionChat: (agentId: string) => void;

  selectedAgent: Agent | null;
  departments: import("../types").Department[];
  tasks: Task[];
  subAgents: SubAgent[];
  subtasks: SubTask[];
  setSelectedAgent: (a: Agent | null) => void;
  handleOpenChat: (agent: Agent) => void;
  setView: (v: import("../appHelpers").View) => void;
  setAgents: React.Dispatch<React.SetStateAction<Agent[]>>;
  setTaskPanel: (v: { taskId: string; tab: TaskPanelTab } | null) => void;

  taskPanel: { taskId: string; tab: TaskPanelTab } | null;

  taskReport: TaskReportDetail | null;
  setTaskReport: (v: TaskReportDetail | null) => void;

  showReportHistory: boolean;
  setShowReportHistory: (v: boolean) => void;

  showAgentStatus: boolean;
  setShowAgentStatus: (v: boolean) => void;

  showAgentManager: boolean;
  setShowAgentManager: (v: boolean) => void;
  hireFromBreakRoom?: boolean;
  onConsumedHireFromBreakRoom?: () => void;
};

export function AppModals(props: AppModalsProps) {
  const {
    showChat, chatAgent, chatContext, messages, agents, streamingMessage,
    handleSendMessage, handleSendAnnouncement, handleSendTeamLeaderAnnouncement, handleSendDirective, setMessages, setShowChat,
    showDecisionInbox, decisionInboxLoading, decisionInboxItems, decisionReplyBusyKey, uiLanguage,
    setShowDecisionInbox, loadDecisionInbox, handleReplyDecisionOption, handleOpenDecisionChat,
    selectedAgent, departments, tasks, subAgents, subtasks,
    setSelectedAgent, handleOpenChat, setView, setAgents, setTaskPanel,
    taskPanel, taskReport, setTaskReport,
    showReportHistory, setShowReportHistory,
    showAgentStatus, setShowAgentStatus,
    showAgentManager, setShowAgentManager,
    hireFromBreakRoom, onConsumedHireFromBreakRoom,
  } = props;

  return (
    <>
      {showChat && (
        <ChatPanel selectedAgent={chatAgent} chatContext={chatContext ?? null} messages={messages} agents={agents} streamingMessage={streamingMessage}
          onSendMessage={handleSendMessage} onSendAnnouncement={handleSendAnnouncement} onSendTeamLeaderAnnouncement={handleSendTeamLeaderAnnouncement}
          onSendDirective={handleSendDirective}
          onClearMessages={async (agentId) => { try { await api.clearMessages(agentId); setMessages([]); } catch (e) { console.error("Clear messages failed:", e); } }}
          onClose={() => setShowChat(false)} />
      )}
      {showDecisionInbox && (
        <DecisionInboxModal open={showDecisionInbox} loading={decisionInboxLoading} items={decisionInboxItems}
          agents={agents} busyKey={decisionReplyBusyKey} uiLanguage={uiLanguage}
          onClose={() => setShowDecisionInbox(false)} onRefresh={() => { void loadDecisionInbox(); }}
          onReplyOption={handleReplyDecisionOption} onOpenChat={handleOpenDecisionChat} />
      )}
      {selectedAgent && (
        <AgentDetail agent={selectedAgent} agents={agents} department={departments.find((d) => d.id === selectedAgent.department_id)}
          departments={departments} tasks={tasks} subAgents={subAgents} subtasks={subtasks}
          onClose={() => setSelectedAgent(null)}
          onChat={(a) => { setSelectedAgent(null); handleOpenChat(a); }}
          onAssignTask={() => { setSelectedAgent(null); setView("tasks"); }}
          onOpenTerminal={(id) => { setSelectedAgent(null); setTaskPanel({ taskId: id, tab: "terminal" }); }}
          onAgentUpdated={() => {
            api.getAgents().then((ags) => {
              setAgents(ags);
              if (selectedAgent) { const updated = ags.find((a) => a.id === selectedAgent.id); if (updated) setSelectedAgent(updated); }
            }).catch(console.error);
          }} />
      )}
      {taskPanel && (
        <TerminalPanel taskId={taskPanel.taskId} initialTab={taskPanel.tab}
          task={tasks.find((t) => t.id === taskPanel.taskId)}
          agent={agents.find((a) => a.current_task_id === taskPanel.taskId || tasks.find((t) => t.id === taskPanel.taskId)?.assigned_agent_id === a.id)}
          agents={agents} onClose={() => setTaskPanel(null)} />
      )}
      {taskReport && <TaskReportPopup report={taskReport} agents={agents} uiLanguage={uiLanguage} onClose={() => setTaskReport(null)} />}
      {showReportHistory && <ReportHistory agents={agents} uiLanguage={uiLanguage} onClose={() => setShowReportHistory(false)} />}
      {showAgentStatus && <AgentStatusPanel agents={agents} uiLanguage={uiLanguage} onClose={() => setShowAgentStatus(false)} />}
      {showAgentManager && (
        <AgentManagerModal
          agents={agents}
          departments={departments}
          onClose={() => {
            setShowAgentManager(false);
            onConsumedHireFromBreakRoom?.();
          }}
          onRefresh={() => {
            api.getAgents().then(setAgents).catch(console.error);
          }}
          initialOpenHireFromBreakRoom={hireFromBreakRoom}
          onConsumedInitialHire={onConsumedHireFromBreakRoom}
        />
      )}
    </>
  );
}
