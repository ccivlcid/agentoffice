import type { SkillLearnProvider, SkillHistoryProvider } from "../../api";
import type { Agent } from "../../types";
import AgentAvatar from "../AgentAvatar";
import { Icon } from "../ui/Icon";
import { BookMarked, BookOpen, Hammer, Leaf } from "lucide-react";
import {
  type TFunction,
  type UnlearnEffect,
  providerLabel,
  roleLabel,
} from "./skillsLibraryHelpers";

interface SkillLearnProviderCardProps {
  provider: SkillLearnProvider;
  agent: Agent | null;
  isSelected: boolean;
  isAlreadyLearned: boolean;
  isUnlearning: boolean;
  unlearnEffect: UnlearnEffect | undefined;
  learnInProgress: boolean;
  preferKoreanName: boolean;
  agents: Agent[];
  t: TFunction;
  onToggle: () => void;
  onUnlearn: () => void;
}

export default function SkillLearnProviderCard({
  provider,
  agent,
  isSelected,
  isAlreadyLearned,
  isUnlearning,
  unlearnEffect,
  learnInProgress,
  preferKoreanName,
  agents,
  t,
  onToggle,
  onUnlearn,
}: SkillLearnProviderCardProps) {
  const hasAgent = !!agent;
  const isAnimating = learnInProgress && isSelected && hasAgent;
  const isHitAnimating = !!unlearnEffect;
  const displayName = agent
    ? (preferKoreanName ? agent.name_ko || agent.name : agent.name || agent.name_ko)
    : t({ ko: "배치된 인원 없음", en: "No assigned member" });

  return (
    <div
      role={hasAgent ? "button" : undefined}
      tabIndex={hasAgent ? 0 : -1}
      onClick={() => { if (!hasAgent || learnInProgress) return; onToggle(); }}
      onKeyDown={(event) => {
        if (!hasAgent || learnInProgress) return;
        const target = event.target as HTMLElement | null;
        if (target?.closest("button")) return;
        if (event.key === "Enter" || event.key === " ") { event.preventDefault(); onToggle(); }
      }}
      aria-disabled={!hasAgent || learnInProgress}
      className={`relative overflow-hidden rounded-xl border p-3 text-left transition-all ${
        !hasAgent
          ? "cursor-not-allowed border-slate-700/80 bg-slate-800/40 opacity-60"
          : isSelected
            ? "border-emerald-500/50 bg-emerald-500/10"
            : "border-slate-700/70 bg-slate-800/60 hover:border-slate-500/80 hover:bg-slate-800/80"
      }`}
    >
      {isAnimating && (
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          {Array.from({ length: 6 }).map((_, idx) => (
            <span
              key={`${provider}-book-${idx}`}
              className="learn-book-drop"
              style={{ left: `${8 + idx * 15}%`, animationDelay: `${idx * 0.15}s` }}
            >
              <Icon icon={BookMarked} size="sm" className={idx % 2 === 0 ? "text-blue-400" : "text-amber-400"} />
            </span>
          ))}
        </div>
      )}
      <div className="relative z-10 flex items-center gap-3">
        <div className={`relative ${isAnimating ? "learn-avatar-reading" : ""} ${isHitAnimating ? "unlearn-avatar-hit" : ""}`}>
          <AgentAvatar agent={agent ?? undefined} agents={agents} size={50} rounded="xl" />
          {isAnimating && <span className="learn-reading-book"><Icon icon={BookOpen} size="sm" className="text-amber-200" /></span>}
          {unlearnEffect === "pot" && <span className="unlearn-pot-drop"><Icon icon={Leaf} size="sm" className="text-emerald-400" /></span>}
          {unlearnEffect === "hammer" && <span className="unlearn-hammer-swing"><Icon icon={Hammer} size="sm" className="text-slate-300" /></span>}
          {isHitAnimating && (
            <span className="unlearn-hit-text">
              {t({ ko: "깡~", en: "Bonk!" })}
            </span>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-[11px] text-slate-400">{providerLabel(provider)}</div>
          <div className="text-sm font-medium text-white truncate">{displayName}</div>
          <div className="text-[11px] text-slate-500">
            {agent
              ? roleLabel(agent.role, t)
              : t({ ko: "사용 불가", en: "Unavailable" })}
          </div>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1.5">
          <div
            className={`text-[11px] px-2 py-0.5 rounded-full border ${
              isAlreadyLearned
                ? "border-emerald-400/50 text-emerald-300 bg-emerald-500/15"
                : isSelected
                  ? "border-blue-400/50 text-blue-300 bg-blue-500/15"
                  : "border-slate-600 text-slate-400 bg-slate-700/40"
            }`}
          >
            {isAlreadyLearned
              ? t({ ko: "학습됨", en: "Learned" })
              : isSelected
                ? t({ ko: "선택됨", en: "Selected" })
                : t({ ko: "대기", en: "Idle" })}
          </div>
          {isAlreadyLearned && (
            <button
              type="button"
              onClick={(event) => { event.stopPropagation(); void onUnlearn(); }}
              disabled={learnInProgress || isUnlearning}
              className={`skill-unlearn-btn rounded-md border px-2 py-0.5 text-[10px] transition-all ${
                learnInProgress || isUnlearning
                  ? "cursor-not-allowed border-slate-700 text-slate-600"
                  : "border-rose-500/35 bg-rose-500/10 text-rose-300 hover:bg-rose-500/20"
              }`}
            >
              {isUnlearning
                ? t({ ko: "취소중...", en: "Unlearning..." })
                : t({ ko: "학습 취소", en: "Unlearn" })}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
