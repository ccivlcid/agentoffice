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
 * 뷰별 "이 화면은 이렇게 쓰세요" 접이식 가이드 블록.
 * 도서관·업무지시·결과물·대시보드 등에서 재사용.
 */
export function ViewGuide({ title, children, defaultOpen = true }: ViewGuideProps) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div
      className="view-guide rounded-xl overflow-hidden border transition-colors"
      style={{
        background: "var(--th-bg-surface)",
        borderColor: "var(--th-border)",
      }}
    >
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-2 px-4 py-3 text-left transition-colors hover:opacity-90"
        style={{ color: "var(--th-text-primary)" }}
        aria-expanded={open}
      >
        <HelpCircle width={20} height={20} className="shrink-0" style={{ color: "var(--th-focus-ring)" }} aria-hidden />
        <span className="font-semibold text-sm">{title}</span>
        <span className="ml-auto shrink-0" style={{ color: "var(--th-text-muted)" }}>
          {open ? <ChevronDown width={18} height={18} /> : <ChevronRight width={18} height={18} />}
        </span>
      </button>
      {open && (
        <div
          className="px-4 pb-4 pt-0 border-t text-sm space-y-2"
          style={{ borderColor: "var(--th-border)", color: "var(--th-text-secondary)" }}
        >
          {children}
        </div>
      )}
    </div>
  );
}
