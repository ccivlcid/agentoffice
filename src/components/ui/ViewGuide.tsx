import { useState, type ReactNode } from "react";
import { HelpCircle, ChevronDown, ChevronRight } from "lucide-react";

export interface ViewGuideProps {
  /** 가이드 제목 (접기 버튼 라벨) */
  title: string;
  /** 접힌 상태에서 펼쳤을 때 보일 내용 */
  children: ReactNode;
  /** 초기 펼침 여부 (기본 true) */
  defaultOpen?: boolean;
}

/**
 * 뷰별 "사용법 및 가이드" 접이식 가이드 블록.
 * 도서관·업무지시·결과물·대시보드 등에서 재사용.
 * 디자인: SkillsLibrary의 "사용법 및 가이드" 패턴 통일.
 */
export function ViewGuide({ title, children, defaultOpen = true }: ViewGuideProps) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className="view-guide bg-slate-800/60 backdrop-blur-sm border border-slate-700/50 rounded-xl overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-2 px-5 py-4 text-left hover:bg-slate-700/30 transition-colors"
        aria-expanded={open}
      >
        <HelpCircle width={22} height={22} className="text-amber-400 shrink-0" aria-hidden />
        <span className="font-semibold text-white">{title}</span>
        {open ? (
          <ChevronDown width={18} height={18} className="text-slate-400 ml-auto" />
        ) : (
          <ChevronRight width={18} height={18} className="text-slate-400 ml-auto" />
        )}
      </button>
      {open && (
        <div className="px-5 pb-5 pt-0 border-t border-slate-700/50">
          <div className="text-sm text-slate-300 space-y-3 mt-3">{children}</div>
        </div>
      )}
    </div>
  );
}
