import { useState } from "react";
import { HelpCircle, ChevronDown, ChevronRight } from "lucide-react";
import type { TFunction } from "./skillsLibraryHelpers";

interface RulesGuideProps {
  t: TFunction;
}

export default function RulesGuide({ t }: RulesGuideProps) {
  const [guideOpen, setGuideOpen] = useState(true);

  return (
    <div className="bg-slate-800/60 backdrop-blur-sm border border-slate-700/50 rounded-xl overflow-hidden">
      <button
        type="button"
        onClick={() => setGuideOpen((v) => !v)}
        className="w-full flex items-center gap-2 px-5 py-4 text-left hover:bg-slate-700/30 transition-colors"
        aria-expanded={guideOpen}
      >
        <HelpCircle width={22} height={22} className="text-amber-400 shrink-0" aria-hidden />
        <span className="font-semibold text-white">{t({ ko: "사용법 및 가이드", en: "Usage & Guide" })}</span>
        {guideOpen ? (
          <ChevronDown width={18} height={18} className="text-slate-400 ml-auto" />
        ) : (
          <ChevronRight width={18} height={18} className="text-slate-400 ml-auto" />
        )}
      </button>
      {guideOpen && (
        <div className="px-5 pb-5 pt-0 border-t border-slate-700/50">
          <div className="text-sm text-slate-300 space-y-3 mt-3">
            <p>
              {t({
                ko: "에이전트 룰을 등록하면 AI 에이전트(CLI)가 작업 시 해당 지침을 따릅니다. 등록된 룰은 '동기화'로 각 CLI 설정 파일에 자동 반영됩니다.",
                en: "Register agent rules to guide AI agents (CLI) during work. Rules are auto-synced to CLI config files when you click 'Sync'.",
              })}
            </p>
            <ul className="list-disc list-inside space-y-1.5 text-slate-400">
              <li>
                {t({
                  ko: "검색/카테고리로 룰을 필터링한 뒤, 「동기화」로 설정 파일에 반영할 수 있습니다.",
                  en: 'Filter rules by search or category, then use "Sync" to write to config files.',
                })}
              </li>
              <li>
                {t({
                  ko: "프리셋에서 인기 룰을 추가하거나, 직접 마크다운으로 작성할 수 있습니다.",
                  en: "Add popular rules from presets or write your own in Markdown.",
                })}
              </li>
            </ul>
            <p className="text-slate-500 text-xs mt-2">
              {t({
                ko: "룰을 동기화한 에이전트는 해당 룰의 지침에 따라 작업을 수행할 수 있습니다.",
                en: "Agents with synced rules can follow the instructions in those rules.",
              })}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
