import { useMemo, useState } from "react";
import type { Agent } from "../types";
import type { CustomSkill } from "../api";
import SkillHistoryPanel from "./SkillHistoryPanel";
import { useSkillsLibrary } from "./skills-library/useSkillsLibrary";
import {
  CATEGORIES,
  categoryLabel,
} from "./skills-library/skillsLibraryHelpers";
import { SKILL_CATEGORY_ICONS } from "../constants/icons";
import { AlertTriangle, BookOpen, Upload, Search, HelpCircle, ChevronDown, ChevronRight } from "lucide-react";
import SkillCard from "./skills-library/SkillCard";
import SkillLearnModal from "./skills-library/SkillLearnModal";
import { useCustomSkills } from "./skills-library/useCustomSkills";
import SkillEditModal from "./skills-library/SkillEditModal";
import SkillDeleteConfirm from "./skills-library/SkillDeleteConfirm";
import SkillUploadModal from "./skills-library/SkillUploadModal";
import ClassroomTrainingAnimation from "./skills-library/ClassroomTrainingAnimation";
import { categorize } from "./skills-library/skillCategorize";
import { formatInstalls } from "./skills-library/skillsLibraryHelpers";

interface SkillsLibraryProps {
  agents: Agent[];
}

export default function SkillsLibrary({ agents }: SkillsLibraryProps) {
  const {
    skills,
    loading,
    error,
    search,
    setSearch,
    selectedCategory,
    setSelectedCategory,
    sortBy,
    setSortBy,
    copiedSkill,
    hoveredSkill,
    detailCache,
    learningSkill,
    selectedProviders,
    learnJob,
    learnSubmitting,
    learnError,
    unlearnError,
    unlearningProviders,
    unlearnEffects,
    historyRefreshToken,
    setHistoryRefreshToken,
    filtered,
    categoryCounts,
    representatives,
    defaultSelectedProviders,
    learnedRepresentatives,
    learnedProvidersBySkill,
    modalLearnedProviders,
    learnInProgress,
    preferKoreanName,
    t,
    localeTag,
    handleCardMouseEnter,
    handleCardMouseLeave,
    handleCopy,
    openLearningModal,
    closeLearningModal,
    toggleProvider,
    handleStartLearning,
    handleUnlearnProvider,
    retryLoad,
  } = useSkillsLibrary(agents);

  const cs = useCustomSkills();
  const [guideOpen, setGuideOpen] = useState(true);
  const [skillHistoryOpen, setSkillHistoryOpen] = useState(true);

  // Merge custom skills into the filtered list as CategorizedSkill-compatible objects
  const customAsCategorized = useMemo(
    () =>
      cs.customSkills.map((s) => ({
        rank: 0,
        name: s.name,
        skillId: s.skill_id || s.name,
        repo: s.repo,
        installs: s.installs,
        category: s.category || categorize(s.name, s.repo),
        installsDisplay: formatInstalls(s.installs, localeTag),
        _customId: s.id,
      })),
    [cs.customSkills, localeTag],
  );

  // Filtered custom skills (apply the same search/category filters)
  const filteredCustom = useMemo(() => {
    let result = customAsCategorized;
    if (selectedCategory !== "All") {
      result = result.filter((s) => s.category === selectedCategory);
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(
        (s) =>
          s.name.toLowerCase().includes(q) ||
          s.repo.toLowerCase().includes(q) ||
          s.category.toLowerCase().includes(q),
      );
    }
    return result;
  }, [customAsCategorized, search, selectedCategory]);

  // Combined category counts
  const combinedCategoryCounts = useMemo(() => {
    const counts = { ...categoryCounts };
    counts.All = (counts.All || 0) + customAsCategorized.length;
    for (const s of customAsCategorized) {
      counts[s.category] = (counts[s.category] || 0) + 1;
    }
    return counts;
  }, [categoryCounts, customAsCategorized]);

  const totalCount = skills.length + cs.customSkills.length;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="text-center">
          <div className="animate-spin w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full mx-auto mb-4" />
          <div className="text-slate-400 text-sm">
            {t({
              ko: "skills.sh 데이터 로딩중...",
              en: "Loading skills.sh data...",
})}
          </div>
        </div>
      </div>
    );
  }

  if (error && skills.length === 0) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="text-center">
          <AlertTriangle className="mx-auto mb-3 h-10 w-10 text-amber-400" aria-hidden />
          <div className="text-slate-400 text-sm">
            {t({
              ko: "스킬 데이터를 불러올 수 없습니다",
              en: "Unable to load skills data",
})}
          </div>
          <div className="text-slate-500 text-xs mt-1">{error}</div>
          <button
            onClick={retryLoad}
            className="mt-4 px-4 py-2 text-sm bg-blue-600/20 text-blue-400 border border-blue-500/30 rounded-lg hover:bg-blue-600/30 transition-all"
          >
            {t({ ko: "다시 시도", en: "Retry" })}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* 사용법 및 가이드 */}
      <div className="bg-slate-800/60 backdrop-blur-sm border border-slate-700/50 rounded-xl overflow-hidden">
        <button
          type="button"
          onClick={() => setGuideOpen((v) => !v)}
          className="w-full flex items-center gap-2 px-5 py-4 text-left hover:bg-slate-700/30 transition-colors"
          aria-expanded={guideOpen}
        >
          <HelpCircle width={22} height={22} className="text-amber-400 shrink-0" aria-hidden />
          <span className="font-semibold text-white">
            {t({ ko: "사용법 및 가이드", en: "Usage & Guide" })}
          </span>
          {guideOpen ? <ChevronDown width={18} height={18} className="text-slate-400 ml-auto" /> : <ChevronRight width={18} height={18} className="text-slate-400 ml-auto" />}
        </button>
        {guideOpen && (
          <div className="px-5 pb-5 pt-0 border-t border-slate-700/50">
            <div className="text-sm text-slate-300 space-y-3 mt-3">
              <p>
                {t({
                  ko: "도서관은 AI 에이전트가 사용할 수 있는 스킬(Skill) 목록을 보여줍니다. skills.sh에서 제공하는 공개 스킬과 직접 등록한 커스텀 스킬을 검색·학습할 수 있습니다.",
                  en: "The Library shows the list of skills that AI agents can use. You can search and learn public skills from skills.sh and custom skills you register.",
                })}
              </p>
              <ul className="list-disc list-inside space-y-1.5 text-slate-400">
                <li>{t({ ko: "검색/카테고리로 스킬을 필터링한 뒤, 스킬 카드의 「학습」으로 에이전트(CLI)에게 해당 스킬을 부여할 수 있습니다.", en: "Filter skills by search or category, then use \"Learn\" on a skill card to assign that skill to an agent (CLI)." })}</li>
                <li>{t({ ko: "「스킬 업로드」로 새 스킬을 추가하고, 「스킬 등록」으로 기존 스킬을 커스텀으로 등록할 수 있습니다.", en: "Use \"Upload\" to add a new skill and \"Register\" to register an existing skill as custom." })}</li>
                <li>{t({ ko: "에이전트 학습 스킬에서 CLI별로 어떤 스킬을 학습했는지 확인할 수 있습니다.", en: "Agent Learned Skills shows which skills each CLI has learned." })}</li>
              </ul>
              <p className="text-slate-500 text-xs mt-2">
                {t({ ko: "스킬을 학습한 에이전트는 해당 스킬의 지침에 따라 작업을 수행할 수 있습니다.", en: "Agents that have learned a skill can perform tasks according to that skill's instructions." })}
              </p>
            </div>
          </div>
        )}
      </div>

      <div className="bg-slate-800/60 backdrop-blur-sm border border-slate-700/50 rounded-xl p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <BookOpen width={24} height={24} className="text-blue-400 shrink-0" aria-hidden />
              {t({
                ko: "Agent Skills 도서관",
                en: "Agent Skills Library",
})}
            </h2>
            <p className="text-sm text-slate-400 mt-1">
              {t({
                ko: "AI 에이전트 스킬 디렉토리 · skills.sh 실시간 데이터",
                en: "AI agent skill directory · live skills.sh data",
})}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div className="text-right">
              <div className="text-2xl font-bold text-empire-gold">{totalCount}</div>
              <div className="text-xs text-slate-500">
                {t({ ko: "등록된 스킬", en: "Registered skills" })}
              </div>
            </div>
            <button
              onClick={() => cs.setShowUploadModal(true)}
              className="px-3 py-1.5 text-xs font-medium bg-emerald-600/20 text-emerald-400 border border-emerald-500/30 rounded-lg hover:bg-emerald-600/30 transition-all"
            >
              <Upload width={14} height={14} className="inline-block align-middle mr-0.5" /> {t({ ko: "스킬 업로드", en: "Upload" })}
            </button>
            <button
              onClick={() => cs.setIsCreateOpen(true)}
              className="px-3 py-1.5 text-xs font-medium bg-blue-600/20 text-blue-400 border border-blue-500/30 rounded-lg hover:bg-blue-600/30 transition-all"
            >
              + {t({ ko: "스킬 등록", en: "Register" })}
            </button>
          </div>
        </div>

        <div className="flex gap-3">
          <div className="flex-1 relative">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t({
                ko: "스킬 검색... (이름, 저장소, 카테고리)",
                en: "Search skills... (name, repo, category)",
})}
              className="w-full bg-slate-900/60 border border-slate-600/50 rounded-lg px-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/25"
            />
            {search && (
              <button
                onClick={() => setSearch("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
              >
                &times;
              </button>
            )}
          </div>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
            className="bg-slate-900/60 border border-slate-600/50 rounded-lg px-3 py-2.5 text-sm text-slate-300 focus:outline-none focus:border-blue-500/50"
          >
            <option value="rank">{t({ ko: "순위순", en: "By Rank" })}</option>
            <option value="installs">{t({ ko: "설치순", en: "By Installs" })}</option>
            <option value="name">{t({ ko: "이름순", en: "By Name" })}</option>
          </select>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {CATEGORIES.map((cat) => (
          <button
            key={cat}
            onClick={() => setSelectedCategory(cat)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
              selectedCategory === cat
                ? "bg-blue-600/20 text-blue-400 border-blue-500/40"
                : "bg-slate-800/40 text-slate-400 border-slate-700/50 hover:bg-slate-700/40 hover:text-slate-300"
            }`}
          >
            {(() => {
              const CatIcon = SKILL_CATEGORY_ICONS[cat];
              return CatIcon ? <CatIcon width={14} height={14} className="shrink-0 inline-block align-middle" /> : null;
            })()}{" "}
            {categoryLabel(cat, t)}
            <span className="ml-1 text-slate-500">
              {combinedCategoryCounts[cat] || 0}
            </span>
          </button>
        ))}
      </div>

      {cs.error && (
        <div className="text-xs text-rose-400 px-1">{cs.error}</div>
      )}

      <div className="text-xs text-slate-500 px-1">
        {filtered.length + filteredCustom.length}
        {t({ ko: "개 스킬 표시중", en: " skills shown" })}
        {search &&
          ` · "${search}" ${t({
            ko: "검색 결과",
            en: "search results",
})}`}
      </div>

      <div className="rounded-xl border border-slate-700/60 bg-slate-900/50 overflow-hidden">
        <button
          type="button"
          onClick={() => setSkillHistoryOpen((v) => !v)}
          className="w-full flex items-center gap-2 px-4 py-3 text-left hover:bg-slate-700/30 transition-colors"
          aria-expanded={skillHistoryOpen}
        >
          <div className="text-sm font-semibold text-slate-100">
            {t({ ko: "에이전트 학습 스킬", en: "Agent Learned Skills" })}
          </div>
          <div className="text-[11px] text-slate-500 ml-auto mr-2">
            {t({ ko: "CLI별 스킬 이력", en: "Per-CLI skill history" })}
          </div>
          {skillHistoryOpen ? <ChevronDown width={18} height={18} className="text-slate-400" /> : <ChevronRight width={18} height={18} className="text-slate-400" />}
        </button>
        {skillHistoryOpen && (
          <div className="px-4 pb-4 pt-0 border-t border-slate-700/50">
            <SkillHistoryPanel
              agents={agents}
              refreshToken={historyRefreshToken}
              onLearningDataChanged={() => setHistoryRefreshToken((prev) => prev + 1)}
              className="h-[380px]"
            />
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
        {/* Custom skills first */}
        {filteredCustom.map((skill) => {
          const detailId = skill.skillId || skill.name;
          const detailKey = `${skill.repo}/${detailId}`;
          return (
            <SkillCard
              key={`custom-${skill._customId}`}
              skill={skill}
              learnedProviders={learnedProvidersBySkill.get(detailKey) ?? []}
              learnedRepresentatives={learnedRepresentatives}
              isHovered={hoveredSkill === detailKey}
              detail={detailCache[detailKey]}
              copiedSkill={copiedSkill}
              agents={agents}
              t={t}
              localeTag={localeTag}
              isCustom
              onMouseEnter={() => handleCardMouseEnter(skill)}
              onMouseLeave={handleCardMouseLeave}
              onCopy={() => handleCopy(skill)}
              onLearn={() => openLearningModal(skill)}
              onEdit={() => {
                const original = cs.customSkills.find((s) => s.id === skill._customId);
                if (original) cs.setEditingSkill(original);
              }}
              onDelete={() => cs.setDeleteConfirmId(skill._customId)}
            />
          );
        })}
        {/* Remote skills from skills.sh */}
        {filtered.map((skill) => {
          const detailId = skill.skillId || skill.name;
          const detailKey = `${skill.repo}/${detailId}`;
          return (
            <SkillCard
              key={`${skill.rank}-${detailId}`}
              skill={skill}
              learnedProviders={learnedProvidersBySkill.get(detailKey) ?? []}
              learnedRepresentatives={learnedRepresentatives}
              isHovered={hoveredSkill === detailKey}
              detail={detailCache[detailKey]}
              copiedSkill={copiedSkill}
              agents={agents}
              t={t}
              localeTag={localeTag}
              onMouseEnter={() => handleCardMouseEnter(skill)}
              onMouseLeave={handleCardMouseLeave}
              onCopy={() => handleCopy(skill)}
              onLearn={() => openLearningModal(skill)}
            />
          );
        })}
      </div>

      {filtered.length === 0 && filteredCustom.length === 0 && (
        <div className="text-center py-16">
          <Search className="mx-auto mb-3 h-10 w-10 text-slate-500" aria-hidden />
          <div className="text-slate-400 text-sm">
            {t({ ko: "검색 결과가 없습니다", en: "No search results" })}
          </div>
          <div className="text-slate-500 text-xs mt-1">
            {t({
              ko: "다른 키워드로 검색해보세요",
              en: "Try a different keyword",
})}
          </div>
        </div>
      )}

      {/* ── Modals ── */}
      {(cs.isCreateOpen || cs.editingSkill) && (
        <SkillEditModal
          skill={cs.editingSkill}
          submitting={cs.submitting}
          t={t}
          onClose={() => {
            cs.setIsCreateOpen(false);
            cs.setEditingSkill(null);
          }}
          onSave={(data) => {
            if (cs.editingSkill) {
              cs.handleUpdate(cs.editingSkill.id, data);
            } else {
              cs.handleCreate(data);
            }
          }}
        />
      )}

      {cs.deleteConfirmId && (() => {
        const toDelete = cs.customSkills.find((s) => s.id === cs.deleteConfirmId);
        if (!toDelete) return null;
        return (
          <SkillDeleteConfirm
            skill={toDelete}
            submitting={cs.submitting}
            t={t}
            onCancel={() => cs.setDeleteConfirmId(null)}
            onConfirm={() => cs.handleDelete(cs.deleteConfirmId!)}
          />
        );
      })()}

      {cs.showUploadModal && (
        <SkillUploadModal
          submitting={cs.submitting}
          t={t}
          onClose={() => cs.setShowUploadModal(false)}
          onUpload={cs.handleUpload}
        />
      )}

      {cs.showTrainingAnimation && (
        <ClassroomTrainingAnimation
          skillName={cs.trainingSkillName}
          provider={cs.trainingProvider}
          onClose={() => cs.setShowTrainingAnimation(false)}
        />
      )}

      {learningSkill && (
        <SkillLearnModal
          skill={learningSkill}
          representatives={representatives}
          selectedProviders={selectedProviders}
          learnJob={learnJob}
          learnSubmitting={learnSubmitting}
          learnError={learnError}
          unlearnError={unlearnError}
          unlearningProviders={unlearningProviders}
          unlearnEffects={unlearnEffects}
          modalLearnedProviders={modalLearnedProviders}
          learnInProgress={learnInProgress}
          preferKoreanName={preferKoreanName}
          agents={agents}
          localeTag={localeTag}
          t={t}
          defaultSelectedProviders={defaultSelectedProviders}
          onClose={closeLearningModal}
          onToggleProvider={toggleProvider}
          onStartLearning={handleStartLearning}
          onUnlearnProvider={handleUnlearnProvider}
        />
      )}

      <div className="text-center text-xs text-slate-600 py-4">
        {t({
          ko: "데이터 출처: skills.sh · 설치: npx skills add <owner/repo>",
          en: "Source: skills.sh · Install: npx skills add <owner/repo>",
})}
      </div>
    </div>
  );
}
