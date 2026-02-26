import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import type { Agent, Message } from '../types';
import { Megaphone } from 'lucide-react';
import { buildSpriteMap } from './AgentAvatar';
import { useI18n } from '../i18n';
import { parseDecisionRequest } from './chat/decision-request';
import type { DecisionOption } from './chat/decision-request';
import { ChatPanelHeader } from './chat-panel/ChatPanelHeader';
import { ChatMessageList } from './chat-panel/ChatMessageList';
import { ChatMessageInput } from './chat-panel/ChatMessageInput';
import { ProjectFlowModal } from './chat-panel/ProjectFlowModal';
import { useProjectFlow } from './chat-panel/useProjectFlow';
import { ROLE_LABELS, STATUS_LABELS, isPromiseLike } from './chat-panel/chatPanelHelpers';
import type { ChatMode, PendingSendAction, ProjectMetaPayload } from './chat-panel/chatPanelTypes';

export type { StreamingMessage } from './chat-panel/chatPanelTypes';

/** 'team_leader_meeting' = 팀장들과의 채팅(전사 채팅에서 팀장만 초대) */
export type ChatContextType = 'announcement' | 'team_leader_meeting' | null;

interface ChatPanelProps {
  selectedAgent: Agent | null;
  chatContext?: ChatContextType;
  messages: Message[];
  agents: Agent[];
  streamingMessage?: import('./chat-panel/chatPanelTypes').StreamingMessage | null;
  onSendMessage: (
    content: string,
    receiverType: 'agent' | 'department' | 'all',
    receiverId?: string,
    messageType?: string,
    projectMeta?: ProjectMetaPayload,
  ) => void | Promise<void>;
  onSendAnnouncement: (content: string) => void;
  onSendTeamLeaderAnnouncement?: (content: string) => void | Promise<void>;
  onSendDirective: (content: string, projectMeta?: ProjectMetaPayload) => void;
  onClearMessages?: (agentId?: string) => void;
  onClose: () => void;
}

export function ChatPanel({
  selectedAgent,
  chatContext = null,
  messages,
  agents,
  streamingMessage,
  onSendMessage,
  onSendAnnouncement,
  onSendTeamLeaderAnnouncement,
  onSendDirective,
  onClearMessages,
  onClose,
}: ChatPanelProps) {
  const [input, setInput] = useState('');
  const [mode, setMode] = useState<ChatMode>(selectedAgent ? 'task' : 'announcement');
  const [decisionReplyKey, setDecisionReplyKey] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const spriteMap = useMemo(() => buildSpriteMap(agents), [agents]);
  const { t, locale } = useI18n();
  const isKorean = locale.startsWith('ko');
  const tr = (ko: string, en: string, ja = en, zh = en) => t({ ko, en, ja, zh });

  const flow = useProjectFlow();

  const getRoleLabel = (role: string) => { const l = ROLE_LABELS[role]; return l ? t(l) : role; };
  const getStatusLabel = (s: string) => { const l = STATUS_LABELS[s]; return l ? t(l) : s; };

  const selectedDeptName = selectedAgent?.department
    ? isKorean
      ? selectedAgent.department.name_ko || selectedAgent.department.name
      : selectedAgent.department.name || selectedAgent.department.name_ko
    : (selectedAgent?.department_id ?? undefined);

  const isStreamingForAgent =
    streamingMessage && selectedAgent && streamingMessage.agent_id === selectedAgent.id;

  useEffect(() => {
    const handle = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handle);
    return () => window.removeEventListener('keydown', handle);
  }, [onClose]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, streamingMessage?.content]);

  useEffect(() => {
    if (!selectedAgent) setMode('announcement');
    else if (mode === 'announcement') setMode('task');
  }, [selectedAgent]);

  useEffect(() => {
    if (flow.open && flow.step === 'existing') void flow.loadRecentProjects();
  }, [flow.open, flow.step]);

  const dispatchPending = useCallback(
    (action: PendingSendAction, projectMeta?: ProjectMetaPayload) => {
      if (action.kind === 'directive') { onSendDirective(action.content, projectMeta); return; }
      if (action.kind === 'announcement') { onSendAnnouncement(action.content); return; }
      if (action.kind === 'task') { onSendMessage(action.content, 'agent', action.receiverId, 'task_assign', projectMeta); return; }
      if (action.kind === 'report') { onSendMessage(action.content, 'agent', action.receiverId, 'report', projectMeta); return; }
      if (action.kind === 'chat') { onSendMessage(action.content, 'agent', action.receiverId, 'chat', projectMeta); return; }
      onSendMessage(action.content, 'all', undefined, undefined, projectMeta);
    },
    [onSendAnnouncement, onSendDirective, onSendMessage],
  );

  const handleSend = () => {
    const trimmed = input.trim();
    if (!trimmed) return;
    if (mode === 'announcement' && chatContext === 'team_leader_meeting' && onSendTeamLeaderAnnouncement) {
      const p = onSendTeamLeaderAnnouncement(trimmed);
      if (p && typeof (p as Promise<unknown>).then === 'function') {
        (p as Promise<void>).then(() => { setInput(''); textareaRef.current?.focus(); }).catch(() => {});
      } else {
        setInput('');
        textareaRef.current?.focus();
      }
      return;
    }
    let action: PendingSendAction;
    if (trimmed.startsWith('$')) {
      const c = trimmed.slice(1).trim();
      if (!c) return;
      action = { kind: 'directive', content: c };
    } else if (mode === 'announcement') {
      action = { kind: 'announcement', content: trimmed };
    } else if (mode === 'task' && selectedAgent) {
      action = { kind: 'task', content: trimmed, receiverId: selectedAgent.id };
    } else if (mode === 'report' && selectedAgent) {
      action = { kind: 'report', content: `[${tr('보고 요청', 'Report Request', 'レポート依頼', '报告请求')}] ${trimmed}`, receiverId: selectedAgent.id };
    } else if (selectedAgent) {
      action = { kind: 'chat', content: trimmed, receiverId: selectedAgent.id };
    } else {
      action = { kind: 'broadcast', content: trimmed };
    }
    if (action.kind === 'directive' || action.kind === 'task' || action.kind === 'report') {
      flow.openFlow(action);
      return;
    }
    dispatchPending(action);
    setInput('');
    textareaRef.current?.focus();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      handleSend();
    }
  };

  const selectedAgentId = selectedAgent?.id;
  const selectedTaskId = selectedAgent?.current_task_id;

  const visibleMessages = useMemo(() => messages.filter((msg) => {
    if (!selectedAgentId) {
      return msg.receiver_type === 'all' || msg.receiver_type === 'team_leaders' || msg.message_type === 'announcement' || msg.message_type === 'directive';
    }
    if (selectedTaskId && msg.task_id === selectedTaskId) return true;
    return (
      (msg.sender_type === 'ceo' && msg.receiver_type === 'agent' && msg.receiver_id === selectedAgentId) ||
      (msg.sender_type === 'agent' && msg.sender_id === selectedAgentId) ||
      msg.message_type === 'announcement' ||
      msg.message_type === 'directive' ||
      msg.receiver_type === 'all'
    );
  }), [messages, selectedAgentId, selectedTaskId]);

  const decisionRequestByMessage = useMemo(() => {
    const mapped = new Map<string, { options: DecisionOption[] }>();
    if (!selectedAgentId) return mapped;
    for (const msg of visibleMessages) {
      if (msg.sender_type !== 'agent' || msg.sender_id !== selectedAgentId) continue;
      const parsed = parseDecisionRequest(msg.content);
      if (parsed) mapped.set(msg.id, parsed);
    }
    return mapped;
  }, [selectedAgentId, visibleMessages]);

  const handleDecisionOptionReply = useCallback((msg: Message, option: DecisionOption) => {
    const receiverId = msg.sender_id;
    if (!receiverId) return;
    const replyContent = tr(
      `[의사결정 회신] ${option.number}번으로 진행해 주세요. (${option.label})`,
      `[Decision Reply] Please proceed with option ${option.number}. (${option.label})`,
      `[意思決定返信] ${option.number}番で進めてください。(${option.label})`,
      `[决策回复] 请按选项 ${option.number} 推进。（${option.label}）`,
    );
    const key = `${msg.id}:${option.number}`;
    setDecisionReplyKey(key);
    const result = onSendMessage(replyContent, 'agent', receiverId, 'chat');
    if (isPromiseLike(result)) {
      result.finally(() => setDecisionReplyKey((prev) => (prev === key ? null : prev)));
      return;
    }
    setDecisionReplyKey(null);
  }, [onSendMessage, tr]);

  const handleDecisionManualDraft = useCallback((option: DecisionOption) => {
    setMode('chat');
    setInput(tr(
      `${option.number}번으로 진행해 주세요. 추가 코멘트: `,
      `Please proceed with option ${option.number}. Additional note: `,
      `${option.number}番で進めてください。追記事項: `,
      `请按选项 ${option.number} 推进。补充说明：`,
    ));
    requestAnimationFrame(() => textareaRef.current?.focus());
  }, [tr]);

  const isDirectiveMode = input.trimStart().startsWith('$');
  const isAnnouncementMode = mode === 'announcement';

  return (
    <div className="fixed inset-0 z-50 flex h-full w-full flex-col bg-gray-900 shadow-2xl lg:relative lg:inset-auto lg:z-auto lg:w-96 lg:border-l lg:border-gray-700">
      <ChatPanelHeader
        selectedAgent={selectedAgent}
        chatContext={chatContext ?? null}
        spriteMap={spriteMap}
        visibleMessageCount={visibleMessages.length}
        isKorean={isKorean}
        tr={tr}
        getRoleLabel={getRoleLabel}
        getStatusLabel={getStatusLabel}
        selectedDeptName={selectedDeptName}
        onClearMessages={onClearMessages}
        onClose={onClose}
      />

      {isAnnouncementMode && (
        <div className={`flex items-center gap-2 px-4 py-2 border-b flex-shrink-0 ${chatContext === 'team_leader_meeting' ? 'bg-cyan-500/10 border-cyan-500/30' : 'bg-yellow-500/10 border-yellow-500/30'}`}>
          <span className={`text-sm font-medium ${chatContext === 'team_leader_meeting' ? 'text-cyan-400' : 'text-yellow-400'}`}>
            <Megaphone width={16} height={16} className="inline-block align-middle mr-1 shrink-0" />
            {chatContext === 'team_leader_meeting'
              ? tr('팀장들과의 채팅', 'Team leader chat')
              : tr('전사 공지 모드 - 모든 에이전트에게 전달됩니다', 'Announcement mode - sent to all agents')}
          </span>
        </div>
      )}

      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3 min-h-0">
        <ChatMessageList
          visibleMessages={visibleMessages}
          agents={agents}
          selectedAgent={selectedAgent}
          isTeamLeaderMeeting={chatContext === 'team_leader_meeting'}
          streamingMessage={streamingMessage}
          isStreamingForAgent={!!isStreamingForAgent}
          spriteMap={spriteMap}
          decisionRequestByMessage={decisionRequestByMessage}
          decisionReplyKey={decisionReplyKey}
          messagesEndRef={messagesEndRef}
          locale={locale}
          isKorean={isKorean}
          tr={tr}
          onDecisionOptionReply={handleDecisionOptionReply}
          onDecisionManualDraft={handleDecisionManualDraft}
        />
      </div>

      <ChatMessageInput
        input={input}
        mode={mode}
        isDirectiveMode={isDirectiveMode}
        isAnnouncementMode={isAnnouncementMode}
        isTeamLeaderMeeting={chatContext === 'team_leader_meeting'}
        selectedAgent={selectedAgent}
        isKorean={isKorean}
        textareaRef={textareaRef}
        tr={tr}
        onInputChange={setInput}
        onKeyDown={handleKeyDown}
        onSend={handleSend}
        onModeChange={setMode}
      />

      {flow.open && (
        <ProjectFlowModal
          step={flow.step}
          items={flow.items}
          loading={flow.loading}
          selected={flow.selected}
          existingInput={flow.existingInput}
          existingError={flow.existingError}
          newName={flow.newName}
          newPath={flow.newPath}
          newGoal={flow.newGoal}
          saving={flow.saving}
          pendingSend={flow.pendingSend}
          isDirectivePending={flow.isDirectivePending}
          tr={tr}
          onClose={flow.closeFlow}
          onSetStep={flow.setStep}
          onSetExistingInput={flow.setExistingInput}
          onSetExistingError={flow.setExistingError}
          onSetNewName={flow.setNewName}
          onSetNewPath={flow.setNewPath}
          onSetNewGoal={flow.setNewGoal}
          onSelectProject={flow.selectProject}
          onApplyExistingSelection={() =>
            flow.applyExistingSelection(tr(
              '번호(1-10) 또는 프로젝트명을 다시 입력해주세요.',
              'Please enter a number (1-10) or a project name.',
              '番号(1-10)またはプロジェクト名を入力してください。',
              '请输入编号(1-10)或项目名称。',
            ))
          }
          onCreateProject={flow.handleCreateProject}
          onConfirmProject={() =>
            flow.handleConfirm({
              dispatchSend: dispatchPending,
              clearInput: () => setInput(''),
              focusTextarea: () => textareaRef.current?.focus(),
            })
          }
          onLoadRecentProjects={flow.loadRecentProjects}
        />
      )}
    </div>
  );
}
