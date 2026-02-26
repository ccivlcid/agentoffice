import type { RefObject } from 'react';
import type { Agent, Message } from '../../types';
import type { StreamingMessage } from './chatPanelTypes';
import type { DecisionOption } from '../chat/decision-request';
import MessageContent from '../MessageContent';
import AgentAvatar from '../AgentAvatar';
import { formatTime, getAgentName } from './chatPanelHelpers';
import { MessageSquare, Hand } from 'lucide-react';

function TypingIndicator() {
  return (
    <div className="flex items-center gap-1 px-4 py-2">
      <div className="flex items-center gap-1 bg-gray-700 rounded-2xl rounded-bl-sm px-4 py-2">
        <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
        <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
        <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
      </div>
    </div>
  );
}

interface DecisionRequestBlockProps {
  msgId: string;
  options: DecisionOption[];
  decisionReplyKey: string | null;
  tr: (ko: string, en: string, ja?: string, zh?: string) => string;
  onOptionReply: (option: DecisionOption) => void;
  onManualDraft: (option: DecisionOption) => void;
}

function DecisionRequestBlock({
  msgId,
  options,
  decisionReplyKey,
  tr,
  onOptionReply,
  onManualDraft,
}: DecisionRequestBlockProps) {
  return (
    <div className="rounded-xl border border-indigo-500/30 bg-indigo-500/10 px-2 py-2">
      <p className="text-[11px] font-medium text-indigo-200">
        {tr('의사결정 요청', 'Decision request', '意思決定リクエスト', '决策请求')}
      </p>
      <div className="mt-1.5 space-y-1">
        {options.map((option) => {
          const key = `${msgId}:${option.number}`;
          const isBusy = decisionReplyKey === key;
          return (
            <button
              key={key}
              type="button"
              onClick={() => onOptionReply(option)}
              disabled={isBusy}
              className="decision-inline-option w-full rounded-md px-2 py-1.5 text-left text-[11px] transition disabled:opacity-60"
            >
              {isBusy
                ? tr('전송 중...', 'Sending...', '送信中...', '发送中...')
                : `${option.number}. ${option.label}`}
            </button>
          );
        })}
      </div>
      <button
        type="button"
        onClick={() => onManualDraft(options[0])}
        className="mt-2 text-[11px] text-indigo-200/90 underline underline-offset-2 hover:text-indigo-100"
      >
        {tr('직접 답변 작성', 'Write custom reply', 'カスタム返信を作成', '编写自定义回复')}
      </button>
    </div>
  );
}

interface ChatMessageListProps {
  visibleMessages: Message[];
  agents: Agent[];
  selectedAgent: Agent | null;
  /** 팀장 회의 모드(전사 공지 아님) */
  isTeamLeaderMeeting?: boolean;
  streamingMessage?: StreamingMessage | null;
  isStreamingForAgent: boolean;
  spriteMap: Map<string, number>;
  decisionRequestByMessage: Map<string, { options: DecisionOption[] }>;
  decisionReplyKey: string | null;
  messagesEndRef: RefObject<HTMLDivElement | null>;
  locale: string;
  isKorean: boolean;
  tr: (ko: string, en: string, ja?: string, zh?: string) => string;
  onDecisionOptionReply: (msg: Message, option: DecisionOption) => void;
  onDecisionManualDraft: (option: DecisionOption) => void;
}

export function ChatMessageList({
  visibleMessages,
  agents,
  selectedAgent,
  isTeamLeaderMeeting = false,
  streamingMessage,
  isStreamingForAgent,
  spriteMap,
  decisionRequestByMessage,
  decisionReplyKey,
  messagesEndRef,
  locale,
  isKorean,
  tr,
  onDecisionOptionReply,
  onDecisionManualDraft,
}: ChatMessageListProps) {
  if (visibleMessages.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4 text-center">
        <MessageSquare className="h-14 w-14 text-slate-500" aria-hidden />
        <div>
          <p className="text-gray-400 font-medium flex items-center justify-center gap-1">
            {tr('대화를 시작해보세요!', 'Start a conversation!', '会話を始めましょう!', '开始对话吧!')}
            <Hand width={16} height={16} className="text-slate-400 inline-block" aria-hidden />
          </p>
          <p className="text-gray-600 text-sm mt-1">
            {selectedAgent
              ? tr(
                  `${getAgentName(selectedAgent, isKorean)}에게 메시지를 보내보세요`,
                  `Send a message to ${getAgentName(selectedAgent, isKorean)}`,
                  `${getAgentName(selectedAgent, isKorean)}にメッセージを送ってみましょう`,
                  `给 ${getAgentName(selectedAgent, isKorean)} 发送一条消息吧`
                )
              : isTeamLeaderMeeting
              ? tr(
                  '팀장들에게 메시지를 보내보세요',
                  'Send a message to team leaders',
                  'チームリーダーにメッセージを送ってみましょう',
                  '给组长发送一条消息吧'
                )
              : tr(
                  '전체 에이전트에게 공지를 보내보세요',
                  'Send an announcement to all agents',
                  'すべてのエージェントに告知を送ってみましょう',
                  '给所有代理发送一条公告吧'
                )}
          </p>
        </div>
        <div ref={messagesEndRef} />
      </div>
    );
  }

  return (
    <>
      {visibleMessages.map((msg) => {
        const isCeo = msg.sender_type === 'ceo';
        const isDirective = msg.message_type === 'directive';
        const isSystem = msg.sender_type === 'system' || msg.message_type === 'announcement' || isDirective;
        const senderAgent = msg.sender_agent ?? agents.find((a) => a.id === msg.sender_id);
        const senderName = isCeo
          ? tr('CEO', 'CEO')
          : isSystem
          ? tr('시스템', 'System', 'システム', '系统')
          : getAgentName(senderAgent, isKorean) || tr('알 수 없음', 'Unknown', '不明', '未知');
        const decisionRequest = decisionRequestByMessage.get(msg.id);

        if (msg.sender_type === 'agent' && msg.receiver_type === 'all') {
          return (
            <div key={msg.id} className="flex items-end gap-2">
              <AgentAvatar agent={senderAgent} spriteMap={spriteMap} size={28} />
              <div className="flex flex-col gap-1 max-w-[75%]">
                <span className="text-xs text-gray-500 px-1">{senderName}</span>
                <div className="announcement-reply-bubble bg-gray-700/70 text-gray-100 text-sm rounded-2xl rounded-bl-sm px-4 py-2.5 shadow-md border border-yellow-500/20">
                  <MessageContent content={msg.content} />
                </div>
                {decisionRequest && (
                  <DecisionRequestBlock
                    msgId={msg.id}
                    options={decisionRequest.options}
                    decisionReplyKey={decisionReplyKey}
                    tr={tr}
                    onOptionReply={(option) => onDecisionOptionReply(msg, option)}
                    onManualDraft={onDecisionManualDraft}
                  />
                )}
                <span className="text-xs text-gray-600 px-1">{formatTime(msg.created_at, locale)}</span>
              </div>
            </div>
          );
        }

        if (isSystem || msg.receiver_type === 'all') {
          return (
            <div key={msg.id} className="flex flex-col items-center gap-1">
              {isDirective && (
                <span className="text-xs font-bold text-red-400 px-2 py-0.5 bg-red-500/10 border border-red-500/30 rounded-full">
                  {tr('업무지시', 'Directive', '業務指示', '业务指示')}
                </span>
              )}
              <div className={`max-w-[85%] text-sm rounded-2xl px-4 py-2.5 text-center shadow-sm ${
                isDirective
                  ? 'bg-red-500/15 border border-red-500/30 text-red-300'
                  : 'announcement-message-bubble bg-yellow-500/15 border border-yellow-500/30 text-yellow-300'
              }`}>
                <MessageContent content={msg.content} />
              </div>
              <span className="text-xs text-gray-600">{formatTime(msg.created_at, locale)}</span>
            </div>
          );
        }

        if (isCeo) {
          return (
            <div key={msg.id} className="flex flex-col items-end gap-1">
              <span className="text-xs text-gray-500 px-1">{tr('CEO', 'CEO')}</span>
              <div className="max-w-[80%] bg-blue-600 text-white text-sm rounded-2xl rounded-br-sm px-4 py-2.5 shadow-md">
                <MessageContent content={msg.content} />
              </div>
              <span className="text-xs text-gray-600 px-1">{formatTime(msg.created_at, locale)}</span>
            </div>
          );
        }

        return (
          <div key={msg.id} className="flex items-end gap-2">
            <AgentAvatar agent={senderAgent} spriteMap={spriteMap} size={28} />
            <div className="flex flex-col gap-1 max-w-[75%]">
              <span className="text-xs text-gray-500 px-1">{senderName}</span>
              <div className="bg-gray-700 text-gray-100 text-sm rounded-2xl rounded-bl-sm px-4 py-2.5 shadow-md">
                <MessageContent content={msg.content} />
              </div>
              {decisionRequest && (
                <DecisionRequestBlock
                  msgId={msg.id}
                  options={decisionRequest.options}
                  decisionReplyKey={decisionReplyKey}
                  tr={tr}
                  onOptionReply={(option) => onDecisionOptionReply(msg, option)}
                  onManualDraft={onDecisionManualDraft}
                />
              )}
              <span className="text-xs text-gray-600 px-1">{formatTime(msg.created_at, locale)}</span>
            </div>
          </div>
        );
      })}

      {isStreamingForAgent && streamingMessage?.content && (
        <div className="flex items-end gap-2">
          <AgentAvatar agent={selectedAgent ?? undefined} spriteMap={spriteMap} size={28} />
          <div className="flex flex-col gap-1 max-w-[75%]">
            <span className="text-xs text-gray-500 px-1">{getAgentName(selectedAgent, isKorean)}</span>
            <div className="bg-gray-700 text-gray-100 text-sm rounded-2xl rounded-bl-sm px-4 py-2.5 shadow-md border border-emerald-500/20">
              <MessageContent content={streamingMessage.content} />
              <span className="inline-block w-1.5 h-4 bg-emerald-400 rounded-sm animate-pulse ml-0.5 align-text-bottom" />
            </div>
          </div>
        </div>
      )}

      {selectedAgent && selectedAgent.status === 'working' && !isStreamingForAgent && (
        <div className="flex items-end gap-2">
          <AgentAvatar agent={selectedAgent ?? undefined} spriteMap={spriteMap} size={28} />
          <TypingIndicator />
        </div>
      )}

      <div ref={messagesEndRef} />
    </>
  );
}
