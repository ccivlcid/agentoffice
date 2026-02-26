import { useMemo, useState, useCallback, useRef, useEffect } from "react";
import type { Agent } from "../types";
import AgentAvatar from "./AgentAvatar";
import MessageContent from "./MessageContent";
import { useI18n } from "../i18n";
import { formatTime } from "./chat-panel/chatPanelHelpers";
import { Users, X, Megaphone } from "lucide-react";

interface SentItem {
  id: string;
  content: string;
  at: number;
}

interface TeamLeaderMeetingModalProps {
  open: boolean;
  agents: Agent[];
  onClose: () => void;
  /** 전달할 내용을 팀장 전체에게 보냄. 각 팀장은 개별 채팅에서 답변 가능 */
  onSendToTeamLeaders?: (content: string) => Promise<void>;
  /** 팀장과 채팅 열기 (답변 확인용) */
  onOpenChat?: (agent: Agent) => void;
}

export default function TeamLeaderMeetingModal({
  open,
  agents,
  onClose,
  onSendToTeamLeaders,
  onOpenChat,
}: TeamLeaderMeetingModalProps) {
  const { t, locale } = useI18n();
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const [sentMessages, setSentMessages] = useState<SentItem[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const teamLeaders = useMemo(
    () => agents.filter((a) => a.role === "team_leader"),
    [agents]
  );

  const isKorean = locale.startsWith("ko");
  const nameOf = (a: Agent) =>
    isKorean ? a.name_ko ?? a.name : a.name ?? a.name_ko;
  const deptOf = (a: Agent) =>
    a.department
      ? isKorean
        ? a.department.name_ko ?? a.department.name
        : a.department.name ?? a.department.name_ko
      : null;

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [sentMessages]);

  useEffect(() => {
    if (!open) {
      setSendError(null);
    }
  }, [open]);

  const handleSend = useCallback(async () => {
    const text = input.trim();
    if (!text || !onSendToTeamLeaders || teamLeaders.length === 0) return;
    setSendError(null);
    setSending(true);
    const id = `tlm-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
    const item: SentItem = { id, content: text, at: Date.now() };
    setSentMessages((prev) => [...prev, item]);
    setInput("");
    textareaRef.current?.focus();
    try {
      await onSendToTeamLeaders(text);
    } catch (e) {
      setSendError(e instanceof Error ? e.message : String(e));
      setSentMessages((prev) => prev.filter((m) => m.id !== id));
      setInput(text);
    } finally {
      setSending(false);
    }
  }, [input, onSendToTeamLeaders, teamLeaders.length]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
        e.preventDefault();
        handleSend();
      }
    },
    [handleSend]
  );

  const canSend =
    input.trim().length > 0 &&
    onSendToTeamLeaders &&
    teamLeaders.length > 0 &&
    !sending;

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col bg-gray-900 shadow-2xl lg:inset-y-0 lg:left-auto lg:right-0 lg:w-[28rem] lg:border-l lg:border-gray-700"
      role="dialog"
      aria-modal="true"
      aria-labelledby="team-leader-meeting-title"
    >
      {/* Header (채팅 패널과 동일 스타일) */}
      <div className="flex flex-shrink-0 items-center justify-between border-b border-gray-700 px-4 py-3">
        <h2
          id="team-leader-meeting-title"
          className="flex items-center gap-2 text-base font-bold text-gray-100"
        >
          <Users width={20} height={20} className="text-cyan-400" />
          {t({ ko: "팀장 회의", en: "Team leader meeting" })}
          <span className="rounded bg-gray-700 px-1.5 py-0.5 text-xs font-medium text-gray-300">
            {teamLeaders.length}
            {t({ ko: "명", en: "" })}
          </span>
        </h2>
        <button
          type="button"
          onClick={onClose}
          className="rounded-lg p-1.5 text-gray-400 transition hover:bg-gray-700 hover:text-white"
          aria-label={t({ ko: "닫기", en: "Close" })}
        >
          <X width={20} height={20} />
        </button>
      </div>

      {/* 배너: 전사 공지 모달처럼 */}
      <div className="flex flex-shrink-0 items-center gap-2 border-b border-cyan-500/30 bg-cyan-500/10 px-4 py-2">
        <Megaphone
          width={16}
          height={16}
          className="shrink-0 text-cyan-400"
          aria-hidden
        />
        <span className="text-sm font-medium text-cyan-200">
          {t({
            ko: "팀장 회의 — 전달 내용은 팀장 전체에게 전송됩니다. 각 팀장의 답변은 채팅에서 확인하세요.",
            en: "Team leader meeting — Your message is sent to all team leaders. View their replies in chat.",
          })}
        </span>
      </div>

      {/* 메시지 목록 (공지 채팅처럼) */}
      <div className="flex-1 overflow-y-auto px-4 py-4 min-h-0 space-y-3">
        {sentMessages.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-4 py-12 text-center">
            <Users className="h-14 w-14 text-cyan-500/50" aria-hidden />
            <div>
              <p className="font-medium text-gray-400">
                {t({
                  ko: "팀장 전체에게 전달할 내용을 입력하세요",
                  en: "Enter a message to send to all team leaders",
                })}
              </p>
              <p className="mt-1 text-sm text-gray-500">
                {t({
                  ko: "전송 후 각 팀장이 채팅으로 답변합니다.",
                  en: "Each leader will reply via chat.",
                })}
              </p>
            </div>
            <div ref={messagesEndRef} />
          </div>
        ) : (
          <>
            {sentMessages.map((msg) => (
              <div
                key={msg.id}
                className="flex flex-col items-center gap-1"
              >
                <div className="max-w-[85%] rounded-2xl border border-cyan-500/30 bg-cyan-500/15 px-4 py-2.5 text-center text-sm text-cyan-100 shadow-sm">
                  <MessageContent content={msg.content} />
                </div>
                <span className="text-xs text-gray-500">
                  {formatTime(msg.at, locale)}
                </span>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </>
        )}
      </div>

      {/* 입력 영역 (ChatMessageInput 스타일) */}
      <div className="flex-shrink-0 border-t border-gray-700 px-4 pb-4 pt-2">
        {sendError && (
          <p className="mb-2 text-xs text-red-400" role="alert">
            {sendError}
          </p>
        )}
        <div className="flex items-end gap-2 rounded-2xl border border-cyan-500/50 bg-gray-800 transition-colors focus-within:border-cyan-400">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={t({
              ko: "팀장 전체에게 전달할 내용...",
              en: "Message to send to all team leaders...",
            })}
            rows={1}
            disabled={sending}
            className="min-h-[44px] max-h-32 flex-1 resize-none overflow-y-auto bg-transparent px-4 py-3 text-sm leading-relaxed text-gray-100 placeholder-gray-500 focus:outline-none disabled:opacity-60"
            style={{ scrollbarWidth: "none" }}
            onInput={(e) => {
              const el = e.currentTarget;
              el.style.height = "auto";
              el.style.height = `${Math.min(el.scrollHeight, 128)}px`;
            }}
          />
          <button
            type="button"
            onClick={handleSend}
            disabled={!canSend}
            className={`mb-2 mr-2 flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl transition-all ${
              canSend
                ? "bg-cyan-600 text-white hover:bg-cyan-500"
                : "cursor-not-allowed bg-gray-700 text-gray-500"
            }`}
            aria-label={t({ ko: "전송", en: "Send" })}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="currentColor"
              className="h-4 w-4"
            >
              <path d="M3.478 2.405a.75.75 0 00-.926.94l2.432 7.905H13.5a.75.75 0 010 1.5H4.984l-2.432 7.905a.75.75 0 00.926.94 60.519 60.519 0 0018.445-8.986.75.75 0 000-1.218A60.517 60.517 0 003.478 2.405z" />
            </svg>
          </button>
        </div>
        <p className="mt-1.5 px-1 text-xs text-gray-500">
          {t({
            ko: "Enter로 전송, Shift+Enter로 줄바꿈",
            en: "Press Enter to send, Shift+Enter for new line",
          })}
        </p>

        {/* 팀장 목록 · 답변 보기 */}
        {teamLeaders.length > 0 && onOpenChat && (
          <div className="mt-3 rounded-lg border border-gray-600/50 bg-gray-800/50 px-3 py-2">
            <p className="mb-2 text-xs font-medium text-gray-400">
              {t({ ko: "팀장 답변 보기", en: "View replies" })}
            </p>
            <div className="flex flex-wrap gap-1.5">
              {teamLeaders.map((agent) => (
                <button
                  key={agent.id}
                  type="button"
                  onClick={() => onOpenChat(agent)}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-gray-600 bg-gray-700/80 px-2.5 py-1.5 text-xs text-gray-200 transition hover:bg-gray-600"
                  aria-label={t({
                    ko: `${nameOf(agent)} 답변 보기`,
                    en: `View ${nameOf(agent)}'s reply`,
                  })}
                >
                  <AgentAvatar
                    agent={agent}
                    agents={agents}
                    size={20}
                    rounded="xl"
                  />
                  <span className="max-w-[80px] truncate">{nameOf(agent)}</span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
