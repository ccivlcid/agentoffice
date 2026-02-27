import { useState, useEffect, useRef } from "react";
import type { CustomSkill } from "../../api";
import type { TFunction } from "./skillsLibraryHelpers";
import { CATEGORIES, categoryLabel } from "./skillsLibraryHelpers";
import { Lightbulb } from "lucide-react";

interface SkillEditModalProps {
  skill: CustomSkill | null;
  submitting: boolean;
  t: TFunction;
  onClose: () => void;
  onSave: (data: {
    name: string;
    skill_id?: string;
    repo?: string;
    category?: string;
    description?: string;
  }) => void;
}

export default function SkillEditModal({
  skill,
  submitting,
  t,
  onClose,
  onSave,
}: SkillEditModalProps) {
  const isEdit = skill !== null;

  const [name, setName] = useState(skill?.name ?? "");
  const [skillId, setSkillId] = useState(skill?.skill_id ?? "");
  const [repo, setRepo] = useState(skill?.repo ?? "");
  const [category, setCategory] = useState(skill?.category ?? "");
  const [description, setDescription] = useState(skill?.description ?? "");
  const nameInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    nameInputRef.current?.focus();
  }, []);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !submitting) onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose, submitting]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || submitting) return;
    onSave({
      name: name.trim(),
      skill_id: skillId.trim() || undefined,
      repo: repo.trim() || undefined,
      category: category || undefined,
      description: description.trim() || undefined,
    });
  }

  const categoryOptions = CATEGORIES.filter((c) => c !== "All");

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="skill-edit-modal-title"
      className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/75 backdrop-blur-sm p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget && !submitting) onClose();
      }}
    >
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-2xl max-h-[90vh] overflow-hidden rounded-2xl border border-slate-700/60 bg-slate-900/95 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-4 border-b border-slate-700/60 px-5 py-4">
          <h3 id="skill-edit-modal-title" className="text-base font-semibold text-white">
            {isEdit
              ? t({ ko: "스킬 수정", en: "Edit Skill" })
              : t({ ko: "새 스킬 등록", en: "Register Skill" })}
          </h3>
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="rounded-lg border border-slate-600 px-2.5 py-1 text-xs text-slate-300 hover:bg-slate-800 transition-all disabled:cursor-not-allowed disabled:text-slate-600"
          >
            {t({ ko: "닫기", en: "Close" })}
          </button>
        </div>

        <div className="space-y-4 overflow-y-auto px-5 py-4 max-h-[calc(90vh-130px)]">
          {/* Guide banner — only shown for new registrations */}
          {!isEdit && (
            <div className="rounded-lg border border-blue-500/20 bg-blue-500/5 px-4 py-3 space-y-2">
              <div className="flex items-center gap-2 text-xs font-semibold text-blue-300">
                <Lightbulb width={16} height={16} className="text-amber-400 shrink-0" aria-hidden />
                {t({ ko: "스킬 등록 가이드", en: "Registration Guide" })}
              </div>
              <ul className="space-y-1 text-[11px] text-slate-400 leading-relaxed list-disc pl-4">
                <li>
                  {t({
                    ko: "스킬 이름(필수)만 입력하면 바로 등록할 수 있습니다.",
                    en: "You can register with just a skill name (required).",
                  })}
                </li>
                <li>
                  {t({
                    ko: "GitHub 저장소가 있으면 owner/repo 형식으로 입력하세요 (예: anthropics/courses).",
                    en: "If hosted on GitHub, enter as owner/repo (e.g. anthropics/courses).",
                  })}
                </li>
                <li>
                  {t({
                    ko: "카테고리를 선택하면 필터에서 쉽게 찾을 수 있습니다. 미선택 시 자동 분류됩니다.",
                    en: "Selecting a category makes filtering easier. Auto-classified if left empty.",
                  })}
                </li>
                <li>
                  {t({
                    ko: "등록한 스킬은 '학습' 버튼으로 CLI 에이전트에게 학습시킬 수 있습니다.",
                    en: "Registered skills can be taught to CLI agents via the 'Learn' button.",
                  })}
                </li>
              </ul>
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1.5">
              {t({ ko: "스킬 이름", en: "Skill Name" })} *
            </label>
            <input
              ref={nameInputRef}
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t({
                ko: "예: react-component-builder",
                en: "e.g. react-component-builder",
              })}
              required
              autoComplete="off"
              className="w-full bg-slate-900/60 border border-slate-600/50 rounded-lg px-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/25"
            />
            <p className="mt-1 text-[10px] text-slate-500">
              {t({
                ko: "스킬을 식별하는 고유 이름입니다. 영문 소문자, 하이픈 권장 (예: code-review-helper)",
                en: "Unique name for the skill. Lowercase letters and hyphens recommended (e.g. code-review-helper)",
              })}
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                {t({ ko: "스킬 ID", en: "Skill ID" })}
              </label>
              <input
                type="text"
                value={skillId}
                onChange={(e) => setSkillId(e.target.value)}
                placeholder={t({
                  ko: "비워두면 이름과 동일",
                  en: "Defaults to name if empty",
                })}
                className="w-full bg-slate-900/60 border border-slate-600/50 rounded-lg px-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/25"
              />
              <p className="mt-1 text-[10px] text-slate-500">
                {t({
                  ko: "skills.sh 내부 식별자. 보통 비워두면 됩니다",
                  en: "Internal skills.sh identifier. Usually leave empty",
                })}
              </p>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                {t({ ko: "저장소", en: "Repository" })}
              </label>
              <input
                type="text"
                value={repo}
                onChange={(e) => setRepo(e.target.value)}
                placeholder="owner/repo"
                className="w-full bg-slate-900/60 border border-slate-600/50 rounded-lg px-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/25"
              />
              <p className="mt-1 text-[10px] text-slate-500">
                {t({
                  ko: "GitHub 저장소 경로 (예: anthropics/courses, vercel/next.js)",
                  en: "GitHub repository path (e.g. anthropics/courses, vercel/next.js)",
                })}
              </p>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1.5">
              {t({ ko: "카테고리", en: "Category" })}
            </label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full bg-slate-900/60 border border-slate-600/50 rounded-lg px-3 py-2.5 text-sm text-slate-300 focus:outline-none focus:border-blue-500/50"
            >
              <option value="">
                {t({ ko: "자동 분류", en: "Auto-classify" })}
              </option>
              {categoryOptions.map((cat) => (
                <option key={cat} value={cat}>
                  {categoryLabel(cat, t)}
                </option>
              ))}
            </select>
            <p className="mt-1 text-[10px] text-slate-500">
              {t({
                ko: "미선택 시 이름과 저장소 기반으로 자동 분류됩니다",
                en: "Auto-classified by name and repo if not selected",
              })}
            </p>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1.5">
              {t({ ko: "설명", en: "Description" })}
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={t({
                ko: "이 스킬이 무엇을 하는지, 어떤 상황에서 유용한지 설명해주세요...",
                en: "Describe what this skill does and when it's useful...",
              })}
              rows={4}
              className="w-full bg-slate-900/60 border border-slate-600/50 rounded-lg px-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/25 resize-y"
            />
            <p className="mt-1 text-[10px] text-slate-500">
              {t({
                ko: "에이전트에게 학습시킬 때 참고되는 설명입니다",
                en: "This description is referenced when teaching the skill to agents",
              })}
            </p>
          </div>
        </div>

        <div className="flex justify-end gap-2 border-t border-slate-700/60 px-5 py-3">
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="px-3 py-1.5 rounded-lg text-xs border border-slate-600 text-slate-300 hover:bg-slate-800 transition-all disabled:cursor-not-allowed disabled:text-slate-600"
          >
            {t({ ko: "취소", en: "Cancel" })}
          </button>
          <button
            type="submit"
            disabled={!name.trim() || submitting}
            className={`px-3 py-1.5 rounded-lg text-xs border transition-all ${
              !name.trim() || submitting
                ? "cursor-not-allowed border-slate-700 text-slate-600"
                : "border-blue-500/50 bg-blue-500/20 text-blue-200 hover:bg-blue-500/30"
            }`}
          >
            {submitting
              ? t({ ko: "저장중...", en: "Saving..." })
              : isEdit
                ? t({ ko: "수정", en: "Save" })
                : t({ ko: "등록", en: "Register" })}
          </button>
        </div>
      </form>
    </div>
  );
}
