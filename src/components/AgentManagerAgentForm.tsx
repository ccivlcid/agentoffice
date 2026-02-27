import { useState } from "react";
import type { Agent, Department } from "../types";
import { useI18n } from "../i18n";

const inputBase =
  "w-full rounded-lg border px-3 py-2.5 text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500/40";
const labelBase = "block text-[11px] font-medium tracking-wide mb-1.5";

export default function AgentFormModal({
  agent,
  departments,
  onSave,
  onCancel,
}: {
  agent: Partial<Agent> | null;
  departments: Department[];
  onSave: (data: Record<string, unknown>) => void;
  onCancel: () => void;
}) {
  const { t } = useI18n();
  const isEdit = !!agent?.id;
  const [name, setName] = useState(agent?.name ?? "");
  const [nameKo, setNameKo] = useState(agent?.name_ko ?? "");
  const [deptId, setDeptId] = useState<string>(agent?.department_id ?? departments[0]?.id ?? "");
  const [role, setRole] = useState<string>(agent?.role ?? "junior");
  const [cliProvider, setCliProvider] = useState(agent?.cli_provider ?? "claude");
  const [spriteNum, setSpriteNum] = useState(agent?.sprite_number ?? 1);
  const [personality, setPersonality] = useState(agent?.personality ?? "");
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!name.trim()) return;
    setSaving(true);
    onSave({
      name: name.trim(),
      name_ko: nameKo.trim() || name.trim(),
      name_ja: agent?.name_ja ?? null,
      name_zh: agent?.name_zh ?? null,
      department_id: deptId,
      role,
      cli_provider: cliProvider,
      sprite_number: spriteNum,
      avatar_emoji: agent?.avatar_emoji ?? "bot",
      personality: personality.trim() || null,
    });
  };

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50"
      onClick={(e) => e.target === e.currentTarget && onCancel()}
    >
      <div
        className="w-[min(440px,92vw)] max-h-[85vh] overflow-y-auto rounded-2xl shadow-xl"
        style={{ background: "var(--th-bg-sidebar)", border: "1px solid var(--th-border)" }}
      >
        <div className="p-5 pb-4" style={{ borderBottom: "1px solid var(--th-border)" }}>
          <h3 className="text-base font-semibold" style={{ color: "var(--th-text-heading)" }}>
            {isEdit ? t({ ko: "에이전트 편집", en: "Edit Agent" }) : t({ ko: "새 에이전트 채용", en: "Hire New Agent" })}
          </h3>
          <p className="mt-1 text-[11px]" style={{ color: "var(--th-text-muted)" }}>
            {isEdit
              ? t({ ko: "이름, 부서, 역할 등을 수정합니다.", en: "Update name, department, role and more." })
              : t({ ko: "오피스에서 업무를 수행할 에이전트를 등록합니다.", en: "Register an agent to work in the office." })}
          </p>
        </div>

        <div className="p-5 space-y-5">
          <section>
            <h4 className="text-[10px] font-semibold uppercase tracking-wider mb-3" style={{ color: "var(--th-text-muted)" }}>
              {t({ ko: "기본 정보", en: "Basic info" })}
            </h4>
            <div className="grid grid-cols-2 gap-4">
              <label className="block">
                <span className={labelBase} style={{ color: "var(--th-text-muted)" }}>{t({ ko: "이름 (EN)", en: "Name (EN)" })}</span>
                <input
                  className={inputBase}
                  style={{ borderColor: "var(--th-border)", background: "var(--th-bg-surface)", color: "var(--th-text-primary)" }}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Agent name"
                />
              </label>
              <label className="block">
                <span className={labelBase} style={{ color: "var(--th-text-muted)" }}>{t({ ko: "이름 (KO)", en: "Name (KO)" })}</span>
                <input
                  className={inputBase}
                  style={{ borderColor: "var(--th-border)", background: "var(--th-bg-surface)", color: "var(--th-text-primary)" }}
                  value={nameKo}
                  onChange={(e) => setNameKo(e.target.value)}
                  placeholder={t({ ko: "한글 이름", en: "Korean name" })}
                />
              </label>
            </div>
            <div className="grid grid-cols-2 gap-4 mt-4">
              <label className="block">
                <span className={labelBase} style={{ color: "var(--th-text-muted)" }}>{t({ ko: "부서", en: "Department" })}</span>
                <select
                  className={inputBase}
                  style={{ borderColor: "var(--th-border)", background: "var(--th-bg-surface)", color: "var(--th-text-primary)" }}
                  value={deptId ?? ""}
                  onChange={(e) => setDeptId(e.target.value)}
                >
                  <option value="">{t({ ko: "휴게실 (미배정)", en: "Break room (unassigned)" })}</option>
                  {departments.map((d) => (
                    <option key={d.id} value={d.id}>{d.icon} {d.name}</option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className={labelBase} style={{ color: "var(--th-text-muted)" }}>{t({ ko: "역할", en: "Role" })}</span>
                <select
                  className={inputBase}
                  style={{ borderColor: "var(--th-border)", background: "var(--th-bg-surface)", color: "var(--th-text-primary)" }}
                  value={role}
                  onChange={(e) => setRole(e.target.value)}
                >
                  <option value="team_leader">Team Leader</option>
                  <option value="senior">Senior</option>
                  <option value="junior">Junior</option>
                  <option value="intern">Intern</option>
                </select>
              </label>
            </div>
          </section>

          <section>
            <h4 className="text-[10px] font-semibold uppercase tracking-wider mb-3" style={{ color: "var(--th-text-muted)" }}>
              {t({ ko: "실행 환경", en: "Runtime" })}
            </h4>
            <div className="grid grid-cols-2 gap-4">
              <label className="block">
                <span className={labelBase} style={{ color: "var(--th-text-muted)" }}>{t({ ko: "CLI 프로바이더", en: "CLI Provider" })}</span>
                <select
                  className={inputBase}
                  style={{ borderColor: "var(--th-border)", background: "var(--th-bg-surface)", color: "var(--th-text-primary)" }}
                  value={cliProvider}
                  onChange={(e) => setCliProvider(e.target.value as Agent["cli_provider"])}
                >
                  {(["claude", "codex", "cursor", "gemini", "opencode", "copilot", "antigravity", "api"] as const).map((p) => (
                    <option key={p} value={p}>{p}</option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className={labelBase} style={{ color: "var(--th-text-muted)" }}>{t({ ko: "오피스 캐릭터", en: "Office character" })}</span>
                <div className="flex flex-wrap gap-1.5 mt-1">
                  {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13].map((n) => (
                    <button
                      key={n}
                      type="button"
                      onClick={() => setSpriteNum(n)}
                      className={`flex h-8 w-8 items-center justify-center overflow-hidden rounded-lg border transition-colors ${
                        spriteNum === n ? "ring-2 ring-offset-2 ring-offset-[var(--th-bg-sidebar)]" : ""
                      }`}
                      style={{
                        borderColor: spriteNum === n ? "var(--th-text-accent)" : "var(--th-border)",
                        background: "var(--th-bg-surface)",
                      }}
                      title={t({ ko: `캐릭터 ${n}`, en: `Character ${n}` })}
                      aria-label={t({ ko: `캐릭터 ${n}`, en: `Character ${n}` })}
                    >
                      <img
                        src={`/sprites/${n}-D-1.png`}
                        alt=""
                        className="h-full w-full object-cover object-bottom"
                        style={{ imageRendering: "pixelated" }}
                      />
                    </button>
                  ))}
                </div>
              </label>
            </div>
          </section>

          <section>
            <h4 className="text-[10px] font-semibold uppercase tracking-wider mb-3" style={{ color: "var(--th-text-muted)" }}>
              {t({ ko: "성격 / 역할 프롬프트", en: "Personality / Role Prompt" })}
            </h4>
            <div className="rounded-xl border p-3.5" style={{ borderColor: "var(--th-border)", background: "var(--th-bg-surface)" }}>
              <textarea
                className="w-full resize-y rounded-lg border px-3 py-2.5 text-sm leading-relaxed transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500/40"
                style={{
                  borderColor: "var(--th-border)",
                  background: "var(--th-bg-sidebar)",
                  color: "var(--th-text-primary)",
                  minHeight: "88px",
                }}
                rows={3}
                value={personality}
                onChange={(e) => setPersonality(e.target.value)}
                placeholder={t({ ko: "예: 차분하고 분석적. 코드 리뷰 시 정확한 피드백을 우선시.", en: "e.g. Calm and analytical. Prioritizes precise feedback in code reviews." })}
              />
              <p className="mt-2 text-[10px] leading-snug" style={{ color: "var(--th-text-muted)" }}>
                {t({ ko: "에이전트의 성격과 역할을 설명하는 프롬프트로, 오케스트레이션 시 참고됩니다.", en: "Used as context for orchestration when assigning and briefing this agent." })}
              </p>
            </div>
          </section>
        </div>

        <div className="flex gap-3 px-5 py-4" style={{ borderTop: "1px solid var(--th-border)", background: "var(--th-bg-surface)" }}>
          <button
            disabled={saving || !name.trim()}
            onClick={handleSave}
            className="flex-1 rounded-xl py-2.5 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-40"
            style={{ background: "var(--th-text-accent)" }}
          >
            {saving ? "..." : isEdit ? t({ ko: "저장", en: "Save" }) : t({ ko: "채용하기", en: "Hire" })}
          </button>
          <button
            onClick={onCancel}
            className="rounded-xl border px-4 py-2.5 text-sm font-medium transition-colors hover:opacity-80"
            style={{ borderColor: "var(--th-border)", color: "var(--th-text-secondary)" }}
          >
            {t({ ko: "취소", en: "Cancel" })}
          </button>
        </div>
      </div>
    </div>
  );
}
