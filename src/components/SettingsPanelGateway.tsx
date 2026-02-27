/**
 * Channel message settings tab — messenger channel list, add/edit/delete, rule notice.
 * Matches docs/telegram-ceo-directive-realtime-updates.md and HAIFeR channel settings UX.
 */

import { useState, useCallback } from "react";
import { useSettingsPanel } from "./SettingsPanelContext";
import * as api from "../api";
import type { MessengerSession } from "../api";
import { GatewayChannelModal } from "./settings/GatewayChannelModal";
import { ViewGuide } from "./ui";
import { Plus, Pencil, Trash2, MessageCircle } from "lucide-react";

function OfficeCharacterThumb({ spriteNumber }: { spriteNumber: number | string | null | undefined }) {
  const n = Math.min(13, Math.max(1, Number(spriteNumber) || 1));
  return (
    <img
      src={`/sprites/${n}-D-1.png`}
      alt=""
      className="h-full w-full object-cover object-bottom shrink-0"
      style={{ imageRendering: "pixelated" }}
      aria-hidden
    />
  );
}

function ChannelCard({
  session,
  agentsLocale,
  onEdit,
  onDelete,
  t,
}: {
  session: MessengerSession;
  agentsLocale: "ko" | "en";
  onEdit: () => void;
  onDelete: () => void;
  t: (x: { ko: string; en: string }) => string;
}) {
  const channelTag = session.channel.toUpperCase();
  const agentName = session.agent_id
    ? agentsLocale === "ko" ? session.agent_name_ko || session.agent_name : session.agent_name || session.agent_name_ko
    : null;

  return (
    <div
      className="flex items-center gap-4 rounded-xl px-4 py-3 transition-colors hover:bg-[var(--th-bg-surface-hover)]"
      style={{ background: "var(--th-bg-surface)", border: "1px solid var(--th-border)" }}
    >
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl overflow-hidden" style={{ background: "var(--th-bg-sidebar)", border: "1px solid var(--th-border)" }}>
        <MessageCircle size={20} style={{ color: "var(--th-text-muted)" }} aria-hidden />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-medium" style={{ color: "var(--th-text-heading)" }}>
            {session.display_name || session.channel}
          </span>
          <span className="rounded-full px-2 py-0.5 text-[10px] font-medium" style={{ color: "var(--th-text-muted)", background: "var(--th-bg-sidebar)" }}>
            {channelTag}
          </span>
          <span className="rounded-full px-2 py-0.5 text-[10px] font-medium text-white" style={{ background: "var(--th-text-accent)" }}>
            {t({ ko: "직접연동", en: "Direct" })}
          </span>
        </div>
        <p className="mt-1 text-[11px]" style={{ color: "var(--th-text-muted)" }}>
          {session.target}
        </p>
        <p className="mt-0.5 flex items-center gap-2 text-[11px]" style={{ color: "var(--th-text-secondary)" }}>
          <span>{t({ ko: "대화 Agent:", en: "Chat Agent:" })}</span>
          {session.agent_id ? (
            <>
              <span className="flex h-4 w-4 shrink-0 overflow-hidden rounded" style={{ background: "var(--th-bg-sidebar)", border: "1px solid var(--th-border)" }}>
                <OfficeCharacterThumb spriteNumber={session.agent_sprite_number} />
              </span>
              <span className="truncate">{agentName ?? ""}</span>
            </>
          ) : (
            <span style={{ color: "var(--th-text-muted)" }}>{t({ ko: "미지정", en: "Not set" })}</span>
          )}
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-1">
        <button
          type="button"
          onClick={onEdit}
          className="rounded-lg p-2 transition-colors hover:opacity-80"
          style={{ color: "var(--th-text-muted)" }}
          title={t({ ko: "편집", en: "Edit" })}
          aria-label={t({ ko: "편집", en: "Edit" })}
        >
          <Pencil size={16} />
        </button>
        <button
          type="button"
          onClick={onDelete}
          className="rounded-lg p-2 transition-colors hover:opacity-80"
          style={{ color: "var(--th-text-muted)" }}
          title={t({ ko: "삭제", en: "Delete" })}
          aria-label={t({ ko: "삭제", en: "Delete" })}
        >
          <Trash2 size={16} />
        </button>
      </div>
    </div>
  );
}

export function SettingsPanelGateway() {
  const { t, form, gwSessions, gwSessionsLoading, loadGwSessions } = useSettingsPanel();
  const localeTag = form.language === "ko" ? "ko" : "en";
  const [modalSession, setModalSession] = useState<MessengerSession | null | "new">(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const handleDelete = useCallback(
    async (id: string) => {
      if (!confirm(t({ ko: "이 채널을 삭제할까요?", en: "Delete this channel?" }))) return;
      setDeletingId(id);
      try {
        const res = await api.deleteGatewaySession(id);
        if (res.ok) loadGwSessions();
      } finally {
        setDeletingId(null);
      }
    },
    [t, loadGwSessions],
  );

  return (
    <section className="space-y-4">
      <ViewGuide title={t({ ko: "사용법 및 가이드", en: "Usage & Guide" })} defaultOpen={false}>
        <p>
          {t({
            ko: "Telegram 등 메신저와 연동해 CEO 지시($) 전송·수신과 작업 완료 알림을 받습니다.",
            en: "Connect Telegram etc. to send/receive CEO directives ($) and task completion notifications.",
          })}
        </p>
        <ul className="list-disc list-inside space-y-1.5 text-slate-400">
          <li>
            {t({
              ko: "「새 채팅 추가」: 채널(Telegram 등), 대상 ID, 표시 이름, 봇 토큰, 대화 Agent 입력 후 저장.",
              en: '"Add channel": enter channel type, target ID, display name, bot token, chat agent, then save.',
            })}
          </li>
          <li>
            {t({
              ko: "메시지 규칙: $로 시작 → 전사 업무지시, 그 외 → 지정한 대화 Agent에게 1:1 전달.",
              en: "Message rules: $ prefix → company directive; others → 1:1 to the assigned chat agent.",
            })}
          </li>
          <li>
            <strong>{t({ ko: "Telegram 자동 연결:", en: "Telegram auto-connect:" })}</strong>{" "}
            {t({
              ko: "봇 토큰과 채팅 ID만 입력하면 서버가 자동으로 Telegram에 연결됩니다.",
              en: "Just enter the bot token and chat ID — the server auto-connects to Telegram.",
            })}
          </li>
        </ul>
      </ViewGuide>

      <div
        className="rounded-2xl overflow-hidden"
        style={{ border: "1px solid var(--th-border)", background: "var(--th-bg-sidebar)" }}
      >
        <div className="flex items-center justify-between gap-4 px-5 py-4" style={{ borderBottom: "1px solid var(--th-border)" }}>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl" style={{ background: "var(--th-bg-surface)", border: "1px solid var(--th-border)" }}>
              <MessageCircle size={20} style={{ color: "var(--th-text-accent)" }} aria-hidden />
            </div>
            <div>
              <h4 className="text-base font-semibold" style={{ color: "var(--th-text-heading)" }}>
                {t({ ko: "채팅 세션", en: "Chat sessions" })}
              </h4>
              <p className="text-[11px] mt-0.5" style={{ color: "var(--th-text-muted)" }}>
                {t({ ko: "메신저 채널과 대화 Agent를 연결합니다", en: "Connect messenger channels to chat agents" })}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setModalSession("new")}
            className="inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium text-white transition-opacity hover:opacity-90"
            style={{ background: "var(--th-text-accent)" }}
          >
            <Plus width={16} height={16} className="shrink-0" aria-hidden />
            {t({ ko: "채널 추가", en: "Add channel" })}
          </button>
        </div>

        <div className="p-4 space-y-3">
          {gwSessionsLoading ? (
            <div className="flex flex-col items-center justify-center rounded-xl py-12 text-center" style={{ background: "var(--th-bg-surface)", border: "1px dashed var(--th-border)" }}>
              <MessageCircle size={32} className="opacity-50 mb-2" style={{ color: "var(--th-text-muted)" }} aria-hidden />
              <p className="text-sm" style={{ color: "var(--th-text-muted)" }}>
                {t({ ko: "채널 목록 로딩 중...", en: "Loading channels..." })}
              </p>
            </div>
          ) : gwSessions.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-xl py-12 text-center" style={{ background: "var(--th-bg-surface)", border: "1px dashed var(--th-border)" }}>
              <MessageCircle size={32} className="opacity-50 mb-2" style={{ color: "var(--th-text-muted)" }} aria-hidden />
              <p className="text-sm font-medium" style={{ color: "var(--th-text-secondary)" }}>
                {t({ ko: "등록된 채널이 없습니다", en: "No channels yet" })}
              </p>
              <p className="mt-1 text-xs max-w-[260px]" style={{ color: "var(--th-text-muted)" }}>
                {t({ ko: "채널을 추가하면 Telegram 등에서 CEO 지시($)와 작업 알림을 주고받을 수 있습니다.", en: "Add a channel to send and receive CEO directives ($) and task notifications via Telegram etc." })}
              </p>
              <button
                type="button"
                onClick={() => setModalSession("new")}
                className="mt-4 inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium text-white"
                style={{ background: "var(--th-text-accent)" }}
              >
                <Plus width={16} height={16} aria-hidden />
                {t({ ko: "첫 채널 추가", en: "Add first channel" })}
              </button>
            </div>
          ) : (
            <ul className="space-y-3">
              {gwSessions.map((s) => (
                <li key={s.id}>
                  <ChannelCard
                    session={s}
                    agentsLocale={localeTag}
                    onEdit={() => setModalSession(s)}
                    onDelete={() => !deletingId && handleDelete(s.id)}
                    t={t}
                  />
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="px-5 py-3 text-[11px]" style={{ borderTop: "1px solid var(--th-border)", background: "var(--th-bg-surface)", color: "var(--th-text-muted)" }}>
          {t({
            ko: "$로 시작 → 전사 공지 · 그 외 → 선택한 대화 Agent에게 1:1 전달",
            en: "$ prefix → company announcement · others → 1:1 to selected chat agent",
          })}
        </div>
      </div>

      {modalSession !== null && (
        <GatewayChannelModal
          session={modalSession === "new" ? null : modalSession}
          onClose={() => setModalSession(null)}
          onSaved={loadGwSessions}
          t={t}
        />
      )}
    </section>
  );
}
