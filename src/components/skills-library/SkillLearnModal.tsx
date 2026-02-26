import type {
  SkillLearnJob,
  SkillLearnProvider,
  SkillHistoryProvider,
} from "../../api";
import type { Agent } from "../../types";
import {
  type CategorizedSkill,
  type TFunction,
  type UnlearnEffect,
  learningStatusLabel,
} from "./skillsLibraryHelpers";
import SkillLearnProviderCard from "./SkillLearnProviderCard";

interface SkillLearnModalProps {
  skill: CategorizedSkill;
  representatives: { provider: SkillLearnProvider; agent: Agent | null }[];
  selectedProviders: SkillLearnProvider[];
  learnJob: SkillLearnJob | null;
  learnSubmitting: boolean;
  learnError: string | null;
  unlearnError: string | null;
  unlearningProviders: SkillLearnProvider[];
  unlearnEffects: Partial<Record<SkillLearnProvider, UnlearnEffect>>;
  modalLearnedProviders: Set<SkillHistoryProvider>;
  learnInProgress: boolean;
  preferKoreanName: boolean;
  agents: Agent[];
  localeTag: string;
  t: TFunction;
  defaultSelectedProviders: SkillLearnProvider[];
  onClose: () => void;
  onToggleProvider: (provider: SkillLearnProvider) => void;
  onStartLearning: () => void;
  onUnlearnProvider: (provider: SkillLearnProvider) => void;
}

export default function SkillLearnModal({
  skill,
  representatives,
  selectedProviders,
  learnJob,
  learnSubmitting,
  learnError,
  unlearnError,
  unlearningProviders,
  unlearnEffects,
  modalLearnedProviders,
  learnInProgress,
  preferKoreanName,
  agents,
  localeTag,
  t,
  defaultSelectedProviders,
  onClose,
  onToggleProvider,
  onStartLearning,
  onUnlearnProvider,
}: SkillLearnModalProps) {
  return (
    <div className="skills-learn-modal fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/75 backdrop-blur-sm p-4">
      <div className="skills-learn-modal-card w-full max-w-3xl max-h-[90vh] overflow-hidden rounded-2xl border border-slate-700/60 bg-slate-900/95 shadow-2xl">
        <div className="flex items-start justify-between gap-4 border-b border-slate-700/60 px-5 py-4">
          <div>
            <h3 className="text-base font-semibold text-white">
              {t({ ko: "스킬 학습 스쿼드", en: "Skill Learning Squad" })}
            </h3>
            <div className="mt-1 text-xs text-slate-400">{skill.name} · {skill.repo}</div>
          </div>
          <button
            onClick={onClose}
            disabled={learnInProgress}
            className={`rounded-lg border px-2.5 py-1 text-xs transition-all ${learnInProgress ? "cursor-not-allowed border-slate-700 text-slate-600" : "border-slate-600 text-slate-300 hover:bg-slate-800"}`}
          >
            {learnInProgress
              ? t({ ko: "학습중", en: "Running" })
              : t({ ko: "닫기", en: "Close" })}
          </button>
        </div>

        <div className="space-y-4 overflow-y-auto px-5 py-4 max-h-[calc(90vh-72px)]">
          <div className="rounded-xl border border-emerald-500/25 bg-emerald-500/8 px-3 py-2">
            <div className="text-[11px] text-emerald-200">
              {t({ ko: "실행 명령", en: "Install command" })}
            </div>
            <div className="mt-1 text-[11px] font-mono text-emerald-300 break-all">
              npx skills add {skill.repo}
            </div>
          </div>

          <div className="flex items-center justify-between gap-3">
            <div className="text-xs text-slate-400">
              {t({ ko: "CLI 대표자를 선택하세요 (복수 선택 가능)", en: "Select CLI representatives (multi-select)" })}
            </div>
            <div className="text-[11px] text-slate-500">
              {selectedProviders.length}{t({ ko: "명 선택됨", en: " selected" })}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {representatives.map((row) => (
              <SkillLearnProviderCard
                key={row.provider}
                provider={row.provider}
                agent={row.agent}
                isSelected={selectedProviders.includes(row.provider)}
                isAlreadyLearned={modalLearnedProviders.has(row.provider)}
                isUnlearning={unlearningProviders.includes(row.provider)}
                unlearnEffect={unlearnEffects[row.provider]}
                learnInProgress={learnInProgress}
                preferKoreanName={preferKoreanName}
                agents={agents}
                t={t}
                onToggle={() => onToggleProvider(row.provider)}
                onUnlearn={() => onUnlearnProvider(row.provider)}
              />
            ))}
          </div>

          <div className="rounded-xl border border-slate-700/70 bg-slate-800/55 p-3">
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
              <div className="text-slate-300">
                {t({ ko: "작업 상태", en: "Job status" })}:{" "}
                <span className={`font-medium ${
                  learnJob?.status === "succeeded" ? "text-emerald-300"
                    : learnJob?.status === "failed" ? "text-rose-300"
                    : learnJob?.status === "running" || learnJob?.status === "queued" ? "text-amber-300"
                    : "text-slate-500"
                }`}>
                  {learningStatusLabel(learnJob?.status ?? null, t)}
                </span>
              </div>
              {learnJob?.completedAt && (
                <div className="text-[11px] text-slate-500">
                  {new Intl.DateTimeFormat(localeTag, { hour: "2-digit", minute: "2-digit", second: "2-digit" }).format(new Date(learnJob.completedAt))}
                </div>
              )}
            </div>
            {learnError && <div className="mt-2 text-[11px] text-rose-300">{learnError}</div>}
            {unlearnError && <div className="mt-2 text-[11px] text-rose-300">{unlearnError}</div>}
            {learnJob?.error && <div className="mt-2 text-[11px] text-rose-300">{learnJob.error}</div>}
            {learnJob && (
              <div className="mt-2 rounded-lg border border-slate-700 bg-slate-900/70 p-2 font-mono text-[10px] text-slate-300 max-h-32 overflow-y-auto space-y-1">
                <div className="text-slate-500">$ {learnJob.command}</div>
                {learnJob.logTail.length > 0
                  ? learnJob.logTail.slice(-10).map((line, idx) => (
                      <div key={`${learnJob.id}-log-${idx}`}>{line}</div>
                    ))
                  : <div className="text-slate-600">{t({ ko: "로그가 아직 없습니다", en: "No logs yet" })}</div>}
              </div>
            )}
          </div>

          <div className="flex justify-end gap-2">
            <button
              onClick={onClose}
              disabled={learnInProgress}
              className={`px-3 py-1.5 rounded-lg text-xs border transition-all ${learnInProgress ? "cursor-not-allowed border-slate-700 text-slate-600" : "border-slate-600 text-slate-300 hover:bg-slate-800"}`}
            >
              {t({ ko: "취소", en: "Cancel" })}
            </button>
            <button
              onClick={onStartLearning}
              disabled={selectedProviders.length === 0 || learnSubmitting || learnInProgress || defaultSelectedProviders.length === 0}
              className={`px-3 py-1.5 rounded-lg text-xs border transition-all ${
                selectedProviders.length === 0 || learnInProgress || defaultSelectedProviders.length === 0
                  ? "cursor-not-allowed border-slate-700 text-slate-600"
                  : "border-emerald-500/50 bg-emerald-500/20 text-emerald-200 hover:bg-emerald-500/30"
              }`}
            >
              {learnSubmitting || learnInProgress
                ? t({ ko: "학습중...", en: "Learning..." })
                : t({ ko: "학습 시작", en: "Start Learning" })}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
