import type { CustomSkill } from "../../api";
import type { TFunction } from "./skillsLibraryHelpers";
import { Trash2 } from "lucide-react";

interface SkillDeleteConfirmProps {
  skill: CustomSkill;
  submitting: boolean;
  t: TFunction;
  onCancel: () => void;
  onConfirm: () => void;
}

export default function SkillDeleteConfirm({
  skill,
  submitting,
  t,
  onCancel,
  onConfirm,
}: SkillDeleteConfirmProps) {
  return (
    <div
      className="fixed inset-0 z-[85] flex items-center justify-center bg-slate-950/75 backdrop-blur-sm p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget && !submitting) onCancel();
      }}
    >
      <div className="w-full max-w-sm rounded-2xl border border-slate-700/60 bg-slate-900/95 shadow-2xl p-5">
        <div className="text-center mb-4">
          <Trash2 className="mx-auto mb-2 h-8 w-8 text-rose-400" aria-hidden />
          <h3 className="text-sm font-semibold text-white mb-1">
            {t({
              ko: "스킬을 삭제하시겠습니까?",
              en: "Delete this skill?",
            })}
          </h3>
          <p className="text-xs text-slate-400 line-clamp-2">
            {skill.name}
          </p>
          {skill.repo && (
            <p className="text-[10px] text-slate-500 mt-0.5">{skill.repo}</p>
          )}
        </div>

        <div className="flex gap-2">
          <button
            onClick={onCancel}
            disabled={submitting}
            className="flex-1 px-3 py-2 rounded-lg text-xs border border-slate-600 text-slate-300 hover:bg-slate-800 transition-all disabled:cursor-not-allowed disabled:text-slate-600"
          >
            {t({ ko: "취소", en: "Cancel" })}
          </button>
          <button
            onClick={onConfirm}
            disabled={submitting}
            className={`flex-1 px-3 py-2 rounded-lg text-xs border transition-all ${
              submitting
                ? "cursor-not-allowed border-slate-700 text-slate-600"
                : "border-rose-500/50 bg-rose-500/20 text-rose-200 hover:bg-rose-500/30"
            }`}
          >
            {submitting
              ? t({ ko: "삭제중...", en: "Deleting..." })
              : t({ ko: "삭제", en: "Delete" })}
          </button>
        </div>
      </div>
    </div>
  );
}
