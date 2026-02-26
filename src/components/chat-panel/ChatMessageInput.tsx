import type { RefObject } from 'react';
import type { Agent } from '../../types';
import type { ChatMode } from './chatPanelTypes';
import { getAgentName } from './chatPanelHelpers';
import { ClipboardList, Megaphone, BarChart3 } from 'lucide-react';

interface ChatMessageInputProps {
  input: string;
  mode: ChatMode;
  isDirectiveMode: boolean;
  isAnnouncementMode: boolean;
  /** 팀장 회의 모드(전사 공지 아님) */
  isTeamLeaderMeeting?: boolean;
  selectedAgent: Agent | null;
  isKorean: boolean;
  textareaRef: RefObject<HTMLTextAreaElement | null>;
  tr: (ko: string, en: string, ja?: string, zh?: string) => string;
  onInputChange: (value: string) => void;
  onKeyDown: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void;
  onSend: () => void;
  onModeChange: (mode: ChatMode) => void;
}

export function ChatMessageInput({
  input,
  mode,
  isDirectiveMode,
  isAnnouncementMode,
  isTeamLeaderMeeting = false,
  selectedAgent,
  isKorean,
  textareaRef,
  tr,
  onInputChange,
  onKeyDown,
  onSend,
  onModeChange,
}: ChatMessageInputProps) {
  const agentName = getAgentName(selectedAgent, isKorean);

  const placeholder = isAnnouncementMode
    ? isTeamLeaderMeeting
      ? tr('팀장들에게 전달할 내용을 입력하세요...', 'Write a message to team leaders...', 'チームリーダーに送る内容を入力...', '输入要发送给组长的内容...')
      : tr('전사 공지 내용을 입력하세요...', 'Write an announcement...', '全体告知内容を入力してください...', '请输入公告内容...')
    : mode === 'task'
    ? tr('업무 지시 내용을 입력하세요...', 'Write a task instruction...', 'タスク指示内容を入力してください...', '请输入任务指示内容...')
    : mode === 'report'
    ? tr('보고 요청 내용을 입력하세요...', 'Write a report request...', 'レポート依頼内容を入力してください...', '请输入报告请求内容...')
    : selectedAgent
    ? tr(
        `${agentName}에게 메시지 보내기...`,
        `Send a message to ${agentName}...`,
        `${agentName}にメッセージを送る...`,
        `向 ${agentName} 发送消息...`
      )
    : tr('메시지를 입력하세요...', 'Type a message...', 'メッセージを入力してください...', '请输入消息...');

  const borderClass = isDirectiveMode
    ? 'border-red-500/50 focus-within:border-red-400'
    : isAnnouncementMode
    ? isTeamLeaderMeeting
      ? 'border-cyan-500/50 focus-within:border-cyan-400'
      : 'border-yellow-500/50 focus-within:border-yellow-400'
    : mode === 'task'
    ? 'border-blue-500/50 focus-within:border-blue-400'
    : mode === 'report'
    ? 'border-emerald-500/50 focus-within:border-emerald-400'
    : 'border-gray-600 focus-within:border-blue-500';

  const sendBtnClass = input.trim()
    ? isDirectiveMode
      ? 'bg-red-600 hover:bg-red-500 text-white'
      : isAnnouncementMode
      ? isTeamLeaderMeeting
        ? 'bg-cyan-600 hover:bg-cyan-500 text-white'
        : 'bg-yellow-500 hover:bg-yellow-400 text-gray-900'
      : mode === 'task'
      ? 'bg-blue-600 hover:bg-blue-500 text-white'
      : mode === 'report'
      ? 'bg-emerald-600 hover:bg-emerald-500 text-white'
      : 'bg-blue-600 hover:bg-blue-500 text-white'
    : 'bg-gray-700 text-gray-600 cursor-not-allowed';

  return (
    <div className="px-4 pb-4 pt-2 flex-shrink-0">
      {/* Quick action buttons */}
      <div className="flex gap-2 pb-1 mb-2 border-t border-gray-700/50 pt-3">
        <button
          onClick={() => onModeChange(mode === 'task' ? 'chat' : 'task')}
          disabled={!selectedAgent}
          className={`flex-1 flex items-center justify-center gap-1 text-xs px-2 py-1.5 rounded-lg transition-colors font-medium ${
            mode === 'task'
              ? 'bg-blue-600 text-white'
              : 'bg-gray-700 text-gray-300 hover:bg-gray-600 disabled:opacity-40 disabled:cursor-not-allowed'
          }`}
        >
          <ClipboardList width={14} height={14} className="shrink-0" aria-hidden />
          <span>{tr('업무 지시', 'Task', 'タスク指示', '任务指示')}</span>
        </button>
        <button
          onClick={() => onModeChange(mode === 'announcement' ? 'chat' : 'announcement')}
          className={`flex-1 flex items-center justify-center gap-1 text-xs px-2 py-1.5 rounded-lg transition-colors font-medium ${
            mode === 'announcement'
              ? isTeamLeaderMeeting
                ? 'bg-cyan-500 text-white'
                : 'bg-yellow-500 text-gray-900'
              : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
          }`}
        >
          <Megaphone width={14} height={14} className="shrink-0" aria-hidden />
          <span>{isTeamLeaderMeeting ? tr('팀장 회의', 'Team meeting', 'チームリーダー会議', '组长会议') : tr('전사 공지', 'Announcement', '全体告知', '全员公告')}</span>
        </button>
        <button
          onClick={() => onModeChange(mode === 'report' ? 'chat' : 'report')}
          disabled={!selectedAgent}
          className={`flex-1 flex items-center justify-center gap-1 text-xs px-2 py-1.5 rounded-lg transition-colors font-medium ${
            mode === 'report'
              ? 'bg-emerald-600 text-white'
              : 'bg-gray-700 text-gray-300 hover:bg-gray-600 disabled:opacity-40 disabled:cursor-not-allowed'
          }`}
        >
          <BarChart3 width={14} height={14} className="shrink-0" aria-hidden />
          <span>{tr('보고 요청', 'Report', 'レポート依頼', '报告请求')}</span>
        </button>
      </div>

      {/* Mode hint */}
      {(mode !== 'chat' || isDirectiveMode) && (
        <div className="px-0 py-1">
          {isDirectiveMode ? (
            <p className="text-xs text-red-400 font-medium">
              {tr('업무지시 모드 — 기획팀이 자동으로 주관합니다', 'Directive mode - Planning team auto-coordinates', '業務指示モード — 企画チームが自動的に主管します', '业务指示模式 — 企划组自动主管')}
            </p>
          ) : (
            <>
              {mode === 'task' && (
                <p className="text-xs text-blue-400 flex items-center gap-1">
                  <ClipboardList width={12} height={12} className="shrink-0" /> {tr('업무 지시 모드 — 에이전트에게 작업을 할당합니다', 'Task mode - assign work to the agent', 'タスク指示モード — エージェントに作業を割り当てます', '任务指示模式 — 向代理分配工作')}
                </p>
              )}
              {mode === 'announcement' && (
                <p className={`text-xs flex items-center gap-1 ${isTeamLeaderMeeting ? 'text-cyan-400' : 'text-yellow-400'}`}>
                  <Megaphone width={12} height={12} className="shrink-0" /> {isTeamLeaderMeeting ? tr('팀장 회의 모드 — 팀장에게만 전달됩니다', 'Team meeting mode - sent to team leaders only', 'チームリーダー会議モード — チームリーダーのみに送信', '组长会议模式 — 仅发送给组长') : tr('전사 공지 모드 — 모든 에이전트에게 전달됩니다', 'Announcement mode - sent to all agents', '全体告知モード — すべてのエージェントに送信', '全员公告模式 — 将发送给所有代理')}
                </p>
              )}
              {mode === 'report' && (
                <p className="text-xs text-emerald-400 flex items-center gap-1">
                  <BarChart3 width={12} height={12} className="shrink-0" /> {tr('보고 요청 모드 — 보고서/발표자료 작성 작업을 요청합니다', 'Report mode - request report/deck authoring', 'レポート依頼モード — レポート/資料作成を依頼します', '报告请求模式 — 请求撰写报告/演示资料')}
                </p>
              )}
            </>
          )}
        </div>
      )}

      {/* Textarea + send button */}
      <div className={`flex items-end gap-2 bg-gray-800 rounded-2xl border transition-colors ${borderClass}`}>
        <textarea
          ref={textareaRef}
          value={input}
          onChange={(e) => onInputChange(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder={placeholder}
          rows={1}
          className="flex-1 bg-transparent text-gray-100 text-sm placeholder-gray-500 resize-none px-4 py-3 focus:outline-none max-h-32 min-h-[44px] overflow-y-auto leading-relaxed"
          style={{ scrollbarWidth: 'none' }}
          onInput={(e) => {
            const el = e.currentTarget;
            el.style.height = 'auto';
            el.style.height = `${Math.min(el.scrollHeight, 128)}px`;
          }}
        />
        <button
          onClick={onSend}
          disabled={!input.trim()}
          className={`flex-shrink-0 w-9 h-9 mb-2 mr-2 rounded-xl flex items-center justify-center transition-all ${sendBtnClass}`}
          aria-label={tr('전송', 'Send', '送信', '发送')}
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
            <path d="M3.478 2.405a.75.75 0 00-.926.94l2.432 7.905H13.5a.75.75 0 010 1.5H4.984l-2.432 7.905a.75.75 0 00.926.94 60.519 60.519 0 0018.445-8.986.75.75 0 000-1.218A60.517 60.517 0 003.478 2.405z" />
          </svg>
        </button>
      </div>
      <p className="text-xs text-gray-600 mt-1.5 px-1">
        {tr('Enter로 전송, Shift+Enter로 줄바꿈', 'Press Enter to send, Shift+Enter for a new line', 'Enterで送信、Shift+Enterで改行', '按 Enter 发送，Shift+Enter 换行')}
      </p>
    </div>
  );
}
