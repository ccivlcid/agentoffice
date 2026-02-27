/**
 * Add/Edit messenger channel modal for channel message settings.
 */

import { useState, useEffect, useRef, useCallback } from "react";
import * as api from "../../api";
import type { MessengerSession, GatewaySessionPayload } from "../../api";
import type { Agent } from "../../types";
import type { TFunction } from "../SettingsPanelShared";

function OfficeCharacterThumb({ spriteNumber, size = 20 }: { spriteNumber: number | null | undefined; size?: number }) {
  const n = Math.min(13, Math.max(1, Number(spriteNumber) || 1));
  return (
    <img
      src={`/sprites/${n}-D-1.png`}
      alt=""
      className="h-full w-full object-cover object-bottom shrink-0"
      style={{ imageRendering: "pixelated", width: size, height: size }}
      aria-hidden
    />
  );
}

const CHANNELS = [
  { value: "telegram", label: "Telegram" },
  { value: "discord", label: "Discord" },
  { value: "whatsapp", label: "WhatsApp" },
  { value: "slack", label: "Slack" },
  { value: "googlechat", label: "Google Chat" },
  { value: "signal", label: "Signal" },
  { value: "imessage", label: "iMessage" },
] as const;

interface GatewayChannelModalProps {
  session: MessengerSession | null;
  onClose: () => void;
  onSaved: () => void;
  t: TFunction;
}

export function GatewayChannelModal({ session, onClose, onSaved, t }: GatewayChannelModalProps) {
  const isEdit = !!session?.id;
  const [channel, setChannel] = useState(session?.channel ?? "telegram");
  const [target, setTarget] = useState(session?.target ?? "");
  const [displayName, setDisplayName] = useState(session?.display_name ?? "");
  const [token, setToken] = useState("");
  const [agentId, setAgentId] = useState<string | null>(session?.agent_id ?? null);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [agentSelectOpen, setAgentSelectOpen] = useState(false);
  const agentSelectRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setLoading(true);
    api
      .getAgents()
      .then(setAgents)
      .catch(() => setAgents([]))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (session) {
      setChannel(session.channel);
      setTarget(session.target);
      setDisplayName(session.display_name);
      setAgentId(session.agent_id);
    } else {
      const ch = CHANNELS.find((c) => c.value === channel);
      if (ch && !displayName) setDisplayName(ch.label);
    }
  }, [session]);

  const closeAgentSelect = useCallback(() => setAgentSelectOpen(false), []);
  useEffect(() => {
    if (!agentSelectOpen) return;
    const onDocClick = (e: MouseEvent) => {
      if (agentSelectRef.current && !agentSelectRef.current.contains(e.target as Node)) closeAgentSelect();
    };
    document.addEventListener("click", onDocClick);
    return () => document.removeEventListener("click", onDocClick);
  }, [agentSelectOpen, closeAgentSelect]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!target.trim() || !displayName.trim()) {
      setError(t({ ko: "대상 ID와 표시 이름을 입력하세요.", en: "Enter target ID and display name." }));
      return;
    }
    setSaving(true);
    try {
      const payload: GatewaySessionPayload = {
        channel,
        target: target.trim(),
        display_name: displayName.trim(),
        agent_id: agentId || null,
        active: true,
      };
      if (isEdit && session) payload.id = session.id;
      if (token.trim()) payload.token = token.trim();
      const res = await api.saveGatewaySession(payload);
      if (res.ok) {
        onSaved();
        onClose();
      } else {
        setError(res.error ?? t({ ko: "저장 실패", en: "Save failed" }));
      }
    } catch (err) {
      setError(String(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center bg-black/80 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="gateway-modal-title"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        className="relative z-10 mx-4 w-full max-w-md rounded-xl border p-5 shadow-2xl"
        style={{
          borderColor: "var(--th-border)",
          backgroundColor: "var(--th-bg-elevated, var(--th-bg-secondary))",
          backgroundClip: "padding-box",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <h3 id="gateway-modal-title" className="text-lg font-semibold" style={{ color: "var(--th-text-heading)" }}>
          {isEdit ? t({ ko: "채팅 편집", en: "Edit channel" }) : t({ ko: "새 채팅 추가", en: "Add channel" })}
        </h3>
        <form onSubmit={handleSubmit} className="mt-4 space-y-3">
          <div>
            <label className="block text-xs font-medium" style={{ color: "var(--th-text-muted)" }}>
              {t({ ko: "채널", en: "Channel" })}
            </label>
            <select
              value={channel}
              onChange={(e) => {
                setChannel(e.target.value);
                const ch = CHANNELS.find((c) => c.value === e.target.value);
                if (ch && !displayName) setDisplayName(ch.label);
              }}
              className="mt-1 w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2"
              style={{ borderColor: "var(--th-border)", color: "var(--th-text)", background: "var(--th-bg)" }}
            >
              {CHANNELS.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium" style={{ color: "var(--th-text-muted)" }}>
              {t({ ko: "대상 ID", en: "Target ID" })}
            </label>
            <input
              type="text"
              value={target}
              onChange={(e) => setTarget(e.target.value)}
              placeholder="7028830484"
              className="mt-1 w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2"
              style={{ borderColor: "var(--th-border)", color: "var(--th-text)", background: "var(--th-bg)" }}
            />
          </div>
          <div>
            <label className="block text-xs font-medium" style={{ color: "var(--th-text-muted)" }}>
              {t({ ko: "표시 이름", en: "Display name" })}
            </label>
            <input
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="Telegram"
              className="mt-1 w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2"
              style={{ borderColor: "var(--th-border)", color: "var(--th-text)", background: "var(--th-bg)" }}
            />
          </div>
          <div>
            <label className="block text-xs font-medium" style={{ color: "var(--th-text-muted)" }}>
              {t({ ko: "봇 토큰", en: "Bot token" })}
            </label>
            <input
              type="text"
              autoComplete="off"
              value={token}
              onChange={(e) => setToken(e.target.value)}
              placeholder={
                isEdit ? t({ ko: "변경 시에만 입력", en: "Enter only to change" }) : "123456789:AAHdqTcvCH1..."
              }
              className="mt-1 w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2"
              style={{ borderColor: "var(--th-border)", color: "var(--th-text)", background: "var(--th-bg)" }}
            />
            {isEdit && (
              <p className="mt-0.5 text-xs" style={{ color: "var(--th-text-muted)" }}>
                {t({ ko: "비워두면 기존 토큰 유지", en: "Leave empty to keep existing token" })}
              </p>
            )}
          </div>
          <div ref={agentSelectRef} className="relative">
            <label className="block text-xs font-medium" style={{ color: "var(--th-text-muted)" }}>
              {t({ ko: "대화 Agent", en: "Chat Agent" })}
            </label>
            <button
              type="button"
              onClick={() => setAgentSelectOpen((v) => !v)}
              className="mt-1 flex w-full items-center gap-2 rounded-lg border px-3 py-2 text-sm text-left focus:outline-none focus:ring-2"
              style={{ borderColor: "var(--th-border)", color: "var(--th-text)", background: "var(--th-bg)" }}
            >
              {agentId ? (() => {
                const a = agents.find((x) => x.id === agentId);
                if (!a) return <span>{t({ ko: "미지정", en: "Not set" })}</span>;
                return (
                  <>
                    <span className="flex h-5 w-5 shrink-0 overflow-hidden rounded" style={{ border: "1px solid var(--th-border)" }}>
                      <OfficeCharacterThumb spriteNumber={a.sprite_number} size={20} />
                    </span>
                    <span className="truncate">{a.name_ko || a.name}</span>
                  </>
                );
              })() : (
                <span style={{ color: "var(--th-text-muted)" }}>{t({ ko: "미지정", en: "Not set" })}</span>
              )}
            </button>
            {agentSelectOpen && (
              <div
                className="absolute left-0 right-0 top-full z-50 mt-1 max-h-48 overflow-y-auto rounded-lg border py-1 shadow-lg"
                style={{ borderColor: "var(--th-border)", background: "var(--th-bg-elevated, var(--th-bg-secondary))" }}
              >
                <button
                  type="button"
                  onClick={() => { setAgentId(null); setAgentSelectOpen(false); }}
                  className="flex w-full items-center gap-2 px-3 py-2 text-sm text-left hover:opacity-90"
                  style={{ color: "var(--th-text-muted)" }}
                >
                  {t({ ko: "미지정", en: "Not set" })}
                </button>
                {agents.map((a) => (
                  <button
                    key={a.id}
                    type="button"
                    onClick={() => { setAgentId(a.id); setAgentSelectOpen(false); }}
                    className="flex w-full items-center gap-2 px-3 py-2 text-sm text-left hover:bg-[var(--th-bg-surface-hover)]"
                    style={{ color: agentId === a.id ? "var(--th-text-accent)" : "var(--th-text)" }}
                  >
                    <span className="flex h-5 w-5 shrink-0 overflow-hidden rounded" style={{ border: "1px solid var(--th-border)" }}>
                      <OfficeCharacterThumb spriteNumber={a.sprite_number} size={20} />
                    </span>
                    <span className="truncate">{a.name_ko || a.name}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
          {error && <p className="text-sm text-red-500">{error}</p>}
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border px-4 py-2 text-sm font-medium transition-colors"
              style={{ borderColor: "var(--th-border)", color: "var(--th-text-muted)" }}
            >
              {t({ ko: "취소", en: "Cancel" })}
            </button>
            <button
              type="submit"
              disabled={saving || loading}
              className="rounded-lg px-4 py-2 text-sm font-medium text-white transition-colors disabled:opacity-50"
              style={{ background: "var(--th-accent)" }}
            >
              {saving ? t({ ko: "저장 중...", en: "Saving..." }) : t({ ko: "저장", en: "Save" })}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
