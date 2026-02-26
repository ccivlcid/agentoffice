/**
 * General (company) settings tab content.
 */

import type { LocalSettings } from "./SettingsPanelShared";
import type { CliProvider } from "../types";
import { useSettingsPanel } from "./SettingsPanelContext";
import { CheckCircle2 } from "lucide-react";

export function SettingsPanelGeneral() {
  const { form, setForm, handleSave, t, saved } = useSettingsPanel();
  return (
    <>
      <section
        className="rounded-xl p-5 sm:p-6 space-y-5"
        style={{ background: "var(--th-card-bg)", border: "1px solid var(--th-card-border)" }}
      >
        <h3
          className="text-sm font-semibold uppercase tracking-wider"
          style={{ color: "var(--th-text-primary)" }}
        >
          {t({ ko: "회사 정보", en: "Company" })}
        </h3>

        <div>
          <label className="block text-xs mb-1" style={{ color: "var(--th-text-secondary)" }}>
            {t({ ko: "회사명", en: "Company Name" })}
          </label>
          <input
            type="text"
            value={form.companyName}
            onChange={(e) => setForm({ ...form, companyName: e.target.value })}
            className="w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500 transition-colors"
            style={{
              background: "var(--th-input-bg)",
              borderColor: "var(--th-input-border)",
              color: "var(--th-text-primary)",
            }}
          />
        </div>

        <div>
          <label className="block text-xs mb-1" style={{ color: "var(--th-text-secondary)" }}>
            {t({ ko: "CEO 이름", en: "CEO Name" })}
          </label>
          <input
            type="text"
            value={form.ceoName}
            onChange={(e) => setForm({ ...form, ceoName: e.target.value })}
            className="w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500 transition-colors"
            style={{
              background: "var(--th-input-bg)",
              borderColor: "var(--th-input-border)",
              color: "var(--th-text-primary)",
            }}
          />
        </div>

        <div className="flex items-center gap-3">
          <label className="text-sm" style={{ color: "var(--th-text-secondary)" }}>
            {t({ ko: "자동 배정", en: "Auto Assign" })}
          </label>
          <button
            onClick={() => setForm({ ...form, autoAssign: !form.autoAssign })}
            className={`w-11 h-6 rounded-full transition-colors relative ${form.autoAssign ? "bg-blue-500" : "bg-slate-600"}`}
          >
            <div
              className={`w-5 h-5 bg-white rounded-full absolute top-0.5 transition-all shadow-sm ${
                form.autoAssign ? "left-[22px]" : "left-0.5"
              }`}
            />
          </button>
        </div>

        <div className="flex items-center gap-3">
          <label className="text-sm" style={{ color: "var(--th-text-secondary)" }}>
            {t({ ko: "자동 업데이트 (전역)", en: "Auto Update (Global)" })}
          </label>
          <button
            onClick={() => setForm({ ...form, autoUpdateEnabled: !form.autoUpdateEnabled })}
            className={`w-11 h-6 rounded-full transition-colors relative ${form.autoUpdateEnabled ? "bg-blue-500" : "bg-slate-600"}`}
            title={t({
              ko: "서버 전체 자동 업데이트 루프를 켜거나 끕니다.",
              en: "Enable or disable auto-update loop for the whole server.",
})}
          >
            <div
              className={`w-5 h-5 bg-white rounded-full absolute top-0.5 transition-all shadow-sm ${
                form.autoUpdateEnabled ? "left-[22px]" : "left-0.5"
              }`}
            />
          </button>
        </div>

        <div className="flex items-center gap-3">
          <label className="text-sm" style={{ color: "var(--th-text-secondary)" }}>
            {t({ ko: "OAuth 자동 스왑", en: "OAuth Auto Swap" })}
          </label>
          <button
            onClick={() => setForm({ ...form, oauthAutoSwap: !(form.oauthAutoSwap !== false) })}
            className={`w-11 h-6 rounded-full transition-colors relative ${
              form.oauthAutoSwap !== false ? "bg-blue-500" : "bg-slate-600"
            }`}
            title={t({
              ko: "실패/한도 시 다음 OAuth 계정으로 자동 전환",
              en: "Auto-switch to next OAuth account on failures/limits",
})}
          >
            <div
              className={`w-5 h-5 bg-white rounded-full absolute top-0.5 transition-all shadow-sm ${
                form.oauthAutoSwap !== false ? "left-[22px]" : "left-0.5"
              }`}
            />
          </button>
        </div>

        <div>
          <label className="block text-xs mb-1" style={{ color: "var(--th-text-secondary)" }}>
            {t({ ko: "기본 CLI 프로바이더", en: "Default CLI Provider" })}
          </label>
          <select
            value={form.defaultProvider}
            onChange={(e) =>
              setForm({ ...form, defaultProvider: e.target.value as CliProvider })
            }
            className="w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500 transition-colors"
            style={{
              background: "var(--th-input-bg)",
              borderColor: "var(--th-input-border)",
              color: "var(--th-text-primary)",
            }}
          >
            <option value="claude">Claude Code</option>
            <option value="codex">Codex CLI</option>
            <option value="gemini">Gemini CLI</option>
            <option value="opencode">OpenCode</option>
          </select>
        </div>

        <div>
          <label className="block text-xs mb-1" style={{ color: "var(--th-text-secondary)" }}>
            {t({ ko: "언어", en: "Language" })}
          </label>
          <select
            value={form.language}
            onChange={(e) =>
              setForm({ ...form, language: e.target.value as LocalSettings["language"] })
            }
            className="w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500 transition-colors"
            style={{
              background: "var(--th-input-bg)",
              borderColor: "var(--th-input-border)",
              color: "var(--th-text-primary)",
            }}
          >
            <option value="ko">{t({ ko: "한국어", en: "Korean" })}</option>
            <option value="en">{t({ ko: "영어", en: "English" })}</option>
          </select>
        </div>
      </section>

      <div className="flex justify-end gap-3">
        {saved && (
          <span className="text-green-400 text-sm self-center">
            <CheckCircle2 width={16} height={16} className="inline-block align-middle mr-1 text-green-400" aria-hidden />
            {t({ ko: "저장 완료", en: "Saved" })}
          </span>
        )}
        <button
          onClick={handleSave}
          className="px-8 py-2.5 bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold rounded-xl transition-all shadow-lg shadow-blue-600/20 hover:shadow-blue-500/30"
        >
          {t({ ko: "저장", en: "Save" })}
        </button>
      </div>
    </>
  );
}
