import type { Agent } from '../../types';
import AgentAvatar from '../AgentAvatar';
import { STATUS_COLORS } from './chatPanelHelpers';
import { getAgentName } from './chatPanelHelpers';
import { Megaphone, X } from 'lucide-react';

/** 'team_leader_meeting' = 팀장들과의 채팅 */
export type ChatContextType = 'announcement' | 'team_leader_meeting' | null;

interface ChatPanelHeaderProps {
  selectedAgent: Agent | null;
  chatContext?: ChatContextType;
  spriteMap: Map<string, number>;
  visibleMessageCount: number;
  isKorean: boolean;
  tr: (ko: string, en: string, ja?: string, zh?: string) => string;
  getRoleLabel: (role: string) => string;
  getStatusLabel: (status: string) => string;
  selectedDeptName: string | undefined;
  onClearMessages?: (agentId?: string) => void;
  onClose: () => void;
}

export function ChatPanelHeader({
  selectedAgent,
  chatContext = null,
  spriteMap,
  visibleMessageCount,
  isKorean,
  tr,
  getRoleLabel,
  getStatusLabel,
  selectedDeptName,
  onClearMessages,
  onClose,
}: ChatPanelHeaderProps) {
  const agentName = getAgentName(selectedAgent, isKorean);
  const isTeamLeaderMeeting = chatContext === 'team_leader_meeting';

  return (
    <div className="chat-header flex items-center gap-3 px-4 py-3 bg-gray-800 flex-shrink-0">
      {selectedAgent ? (
        <>
          <div className="relative flex-shrink-0">
            <AgentAvatar agent={selectedAgent} spriteMap={spriteMap} size={40} />
            <span
              className={`absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-gray-800 ${
                STATUS_COLORS[selectedAgent.status] ?? 'bg-gray-500'
              }`}
            />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-white text-sm truncate">{agentName}</span>
              <span className="text-xs px-1.5 py-0.5 bg-gray-700 text-gray-300 rounded">
                {getRoleLabel(selectedAgent.role)}
              </span>
            </div>
            <div className="flex items-center gap-1.5 mt-0.5">
              <span className="text-xs text-gray-400 truncate">{selectedDeptName}</span>
              <span className="text-gray-600">·</span>
              <span className="text-xs text-gray-400">{getStatusLabel(selectedAgent.status)}</span>
            </div>
          </div>
        </>
      ) : (
        <>
          <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${isTeamLeaderMeeting ? 'bg-cyan-500/20' : 'bg-yellow-500/20'}`}>
            <Megaphone width={20} height={20} className={isTeamLeaderMeeting ? 'text-cyan-400' : 'text-yellow-400'} aria-hidden />
          </div>
          <div className="flex-1 min-w-0">
            <div className="font-semibold text-white text-sm">
              {isTeamLeaderMeeting ? tr('팀장 회의', 'Team Leader Meeting', 'チームリーダー会議', '组长会议') : tr('전사 공지', 'Company Announcement', '全体告知', '全员公告')}
            </div>
            <div className="text-xs text-gray-400 mt-0.5">
              {isTeamLeaderMeeting ? tr('팀장 전용 채널 · 팀장만 참여합니다', 'Team leaders only · only team leaders participate', 'チームリーダー専用チャンネル', '仅组长参与') : tr('모든 에이전트에게 전달됩니다', 'Sent to all agents', 'すべてのエージェントに送信されます', '将发送给所有代理')}
            </div>
          </div>
        </>
      )}

      <div className="flex items-center gap-1 flex-shrink-0">
        {onClearMessages && visibleMessageCount > 0 && (
          <button
            onClick={() => {
              if (
                window.confirm(
                  selectedAgent
                    ? tr(
                        `${agentName}와의 대화를 삭제하시겠습니까?`,
                        `Delete conversation with ${agentName}?`,
                        `${agentName}との会話を削除しますか？`,
                        `要删除与 ${agentName} 的对话吗？`
                      )
                    : isTeamLeaderMeeting
                    ? tr(
                        '팀장 회의 채팅 내역을 삭제하시겠습니까?',
                        'Delete team leader meeting chat history?',
                        'チームリーダー会議チャット履歴を削除しますか？',
                        '要删除组长会议聊天记录吗？'
                      )
                    : tr(
                        '전사 공지 내역을 삭제하시겠습니까?',
                        'Delete announcement history?',
                        '全体告知履歴を削除しますか？',
                        '要删除全员公告记录吗？'
                      )
                )
              ) {
                onClearMessages(selectedAgent?.id);
              }
            }}
            className="w-8 h-8 flex items-center justify-center rounded-full text-gray-500 hover:text-red-400 hover:bg-gray-700 transition-colors"
            title={tr('대화 내역 삭제', 'Clear message history', '会話履歴を削除', '清除消息记录')}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M3 6h18M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2m3 0v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6h14" />
            </svg>
          </button>
        )}
        <button
          onClick={onClose}
          className="w-8 h-8 flex items-center justify-center rounded-full text-gray-400 hover:text-white hover:bg-gray-700 transition-colors"
          aria-label={tr('닫기', 'Close', '閉じる', '关闭')}
        >
          <X width={18} height={18} aria-hidden />
        </button>
      </div>
    </div>
  );
}
