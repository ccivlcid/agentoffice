import type { SkillDetail, SkillHistoryProvider } from "../../api";
import type { Agent } from "../../types";
import AgentAvatar from "../AgentAvatar";
import {
  type CategorizedSkill,
  type TFunction,
  CATEGORY_COLORS,
  categoryLabel,
  getRankBadge,
  formatFirstSeen,
  localizeAuditStatus,
  learnedProviderLabel,
} from "./skillsLibraryHelpers";
import { cliProviderIcon } from "./SkillsLibraryProviderLogos";
import { SKILL_CATEGORY_ICONS } from "../../constants/icons";
import { Pencil, Trash2 } from "lucide-react";

interface SkillCardProps {
  skill: CategorizedSkill;
  learnedProviders: SkillHistoryProvider[];
  learnedRepresentatives: Map<SkillHistoryProvider, Agent | null>;
  isHovered: boolean;
  detail: SkillDetail | "loading" | "error" | undefined;
  copiedSkill: string | null;
  agents: Agent[];
  t: TFunction;
  localeTag: string;
  isCustom?: boolean;
  onMouseEnter: () => void;
  onMouseLeave: () => void;
  onCopy: () => void;
  onLearn: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
}

export default function SkillCard({
  skill,
  learnedProviders,
  learnedRepresentatives,
  isHovered,
  detail,
  copiedSkill,
  agents,
  t,
  localeTag,
  isCustom,
  onMouseEnter,
  onMouseLeave,
  onCopy,
  onLearn,
  onEdit,
  onDelete,
}: SkillCardProps) {
  const badge = getRankBadge(skill.rank);
  const catColor = CATEGORY_COLORS[skill.category] || CATEGORY_COLORS.Other;
  const detailId = skill.skillId || skill.name;
  const detailKey = `${skill.repo}/${detailId}`;
  const learnedProvidersForCard = learnedProviders.slice(0, 4);

  return (
    <div
      className="relative bg-slate-800/50 border border-slate-700/40 rounded-xl p-4 hover:bg-slate-800/70 hover:border-slate-600/50 transition-all group"
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
    >
      {/* Custom skill badge + edit/delete */}
      {isCustom && (
        <div className="mb-2 flex items-center justify-between">
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-400 border border-amber-500/30 font-medium">
            {t({ ko: "직접 등록", en: "Custom" })}
          </span>
          <div className="flex gap-1">
            <button
              onClick={onEdit}
              className="px-1.5 py-0.5 text-[10px] rounded border border-slate-600/50 text-slate-400 hover:text-blue-300 hover:border-blue-500/40 transition-all"
              title={t({ ko: "수정", en: "Edit" })}
            >
              <Pencil width={12} height={12} className="inline-block" />
            </button>
            <button
              onClick={onDelete}
              className="px-1.5 py-0.5 text-[10px] rounded border border-slate-600/50 text-slate-400 hover:text-rose-300 hover:border-rose-500/40 transition-all"
              title={t({ ko: "삭제", en: "Delete" })}
            >
              <Trash2 width={12} height={12} className="inline-block" />
            </button>
          </div>
        </div>
      )}

      {/* Top row: rank + name + learned providers */}
      <div className="mb-3 flex items-start justify-between gap-2">
        <div className="flex min-w-0 items-start gap-3">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-900/60 text-sm font-bold">
            {badge.label ? (
              badge.isMedal ? (
                <span className={`inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold ${badge.color}`}>
                  {badge.label}
                </span>
              ) : (
                <span className={badge.color}>{badge.label}</span>
              )
            ) : (
              <span className={badge.color}>#{skill.rank}</span>
            )}
          </div>
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-semibold text-white">
              {skill.name}
            </div>
            <div className="mt-0.5 truncate text-xs text-slate-500">
              {skill.repo || t({ ko: "로컬 스킬", en: "Local skill" })}
            </div>
          </div>
        </div>
        {learnedProvidersForCard.length > 0 && (
          <div className="grid w-[64px] shrink-0 grid-cols-2 gap-1 rounded-lg border border-emerald-500/25 bg-emerald-500/5 p-1">
            {learnedProvidersForCard.map((provider) => {
              const agent = learnedRepresentatives.get(provider) ?? null;
              return (
                <span
                  key={`${detailKey}-${provider}`}
                  className="inline-flex h-5 w-6 items-center justify-center gap-0.5 rounded-md border border-emerald-500/20 bg-slate-900/70"
                  title={`${learnedProviderLabel(provider)}${agent ? ` · ${agent.name}` : ""}`}
                >
                  <span className="flex h-2.5 w-2.5 items-center justify-center">
                    {cliProviderIcon(provider)}
                  </span>
                  <span className="h-2.5 w-2.5 overflow-hidden rounded-[3px] bg-slate-800/80">
                    <AgentAvatar
                      agent={agent ?? undefined}
                      agents={agents}
                      size={10}
                      rounded="xl"
                    />
                  </span>
                </span>
              );
            })}
          </div>
        )}
      </div>

      {/* Bottom row: category + installs + learn/copy */}
      <div className="flex items-center justify-between gap-2">
        <span className={`text-[10px] px-2 py-0.5 rounded-full border inline-flex items-center gap-1 ${catColor}`}>
          {(() => {
            const CatIcon = SKILL_CATEGORY_ICONS[skill.category];
            return CatIcon ? <CatIcon width={12} height={12} className="shrink-0" /> : null;
          })()}
          {categoryLabel(skill.category, t)}
        </span>
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-xs text-slate-400">
            <span className="text-empire-green font-medium">
              {skill.installsDisplay}
            </span>{" "}
            {t({ ko: "설치", en: "installs" })}
          </span>
          <div className="flex flex-col gap-1">
            <button
              onClick={onLearn}
              className="px-2 py-1 text-[10px] bg-emerald-600/20 text-emerald-300 border border-emerald-500/30 rounded-md hover:bg-emerald-600/30 transition-all"
              title={t({
                ko: "CLI 대표자에게 스킬 학습시키기",
                en: "Teach this skill to selected CLI leaders",
})}
            >
              {t({ ko: "학습", en: "Learn" })}
            </button>
            <button
              onClick={onCopy}
              className="px-2 py-1 text-[10px] bg-blue-600/20 text-blue-400 border border-blue-500/30 rounded-md hover:bg-blue-600/30 transition-all"
              title={`npx skills add ${skill.repo}`}
            >
              {copiedSkill === skill.name
                ? t({ ko: "복사됨", en: "Copied" })
                : t({ ko: "복사", en: "Copy" })}
            </button>
          </div>
        </div>
      </div>

      {/* Hover Detail Tooltip */}
      {isHovered && (
        <div
          className="absolute z-50 left-0 right-0 top-full mt-2 bg-slate-900/95 backdrop-blur-md border border-slate-600/60 rounded-xl p-4 shadow-2xl shadow-black/40 animate-in fade-in slide-in-from-top-1 duration-200"
          onMouseEnter={onMouseEnter}
          onMouseLeave={onMouseLeave}
        >
          {detail === "loading" && (
            <div className="flex items-center gap-2 text-slate-400 text-xs">
              <div className="animate-spin w-3 h-3 border border-blue-500 border-t-transparent rounded-full" />
              {t({ ko: "상세정보 로딩중...", en: "Loading details..." })}
            </div>
          )}
          {detail === "error" && (
            <div className="text-slate-500 text-xs">
              {t({ ko: "상세정보를 불러올 수 없습니다", en: "Could not load details" })}
            </div>
          )}
          {detail && typeof detail === "object" && (
            <div className="space-y-3">
              {detail.title && (
                <div className="text-sm font-semibold text-white">
                  {detail.title}
                </div>
              )}
              {detail.description && (
                <p className="text-xs text-slate-300 leading-relaxed">
                  {detail.description}
                </p>
              )}
              {detail.whenToUse.length > 0 && (
                <div className="space-y-1.5">
                  <div className="text-[10px] text-slate-500 uppercase tracking-wider">
                    {t({ ko: "사용 시점", en: "When to Use" })}
                  </div>
                  <ul className="list-disc pl-4 space-y-1 text-[11px] text-slate-300">
                    {detail.whenToUse.slice(0, 6).map((item, idx) => (
                      <li key={`${detailKey}-when-${idx}`}>{item}</li>
                    ))}
                  </ul>
                </div>
              )}
              <div className="flex flex-wrap gap-3 text-[11px]">
                {detail.weeklyInstalls && (
                  <span className="text-slate-400">
                    <span className="text-empire-green font-medium">{detail.weeklyInstalls}</span>
                    {" "}{t({ ko: "주간 설치", en: "weekly" })}
                  </span>
                )}
                {detail.firstSeen && (
                  <span className="text-slate-500">
                    {t({ ko: "최초 등록", en: "First seen" })}: {formatFirstSeen(detail.firstSeen, localeTag)}
                  </span>
                )}
              </div>
              {detail.platforms.length > 0 && (
                <div>
                  <div className="text-[10px] text-slate-500 mb-1.5 uppercase tracking-wider">
                    {t({ ko: "플랫폼별 설치", en: "Platform Installs" })}
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {detail.platforms.slice(0, 6).map((p) => (
                      <span
                        key={p.name}
                        className="text-[10px] px-2 py-0.5 bg-slate-800/80 border border-slate-700/50 rounded-md text-slate-400"
                      >
                        {p.name} <span className="text-empire-green">{p.installs}</span>
                      </span>
                    ))}
                  </div>
                </div>
              )}
              {detail.audits.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {detail.audits.map((a) => (
                    <span
                      key={a.name}
                      className={`text-[10px] px-2 py-0.5 rounded-md border ${
                        a.status.toLowerCase() === "pass"
                          ? "text-green-400 bg-green-500/10 border-green-500/30"
                          : a.status.toLowerCase() === "warn" || a.status.toLowerCase() === "pending"
                          ? "text-amber-400 bg-amber-500/10 border-amber-500/30"
                          : "text-red-400 bg-red-500/10 border-red-500/30"
                      }`}
                    >
                      {a.name}: {localizeAuditStatus(a.status, t)}
                    </span>
                  ))}
                </div>
              )}
              <div className="text-[10px] text-slate-500 font-mono bg-slate-800/60 rounded-md px-2 py-1.5 truncate">
                $ {detail.installCommand}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
