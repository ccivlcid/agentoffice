import type { ReactNode } from "react";

export interface PageHeaderProps {
  /** 페이지 제목 (h1) */
  title: string;
  /** 부제/설명 (선택) */
  subtitle?: string;
  /** 오른쪽 CTA 영역 (버튼 등) */
  actions?: ReactNode;
  /** 추가 className (페이지별 스타일) */
  className?: string;
}

/**
 * 공통 페이지 헤더: 제목 + 부제 + 선택 CTA.
 * 결과물·업무지시·도서관 등 뷰 상단 통일용.
 */
export function PageHeader({ title, subtitle, actions, className = "" }: PageHeaderProps) {
  return (
    <header
      className={`page-header shrink-0 ${className}`.trim()}
      style={{
        borderBottom: "1px solid var(--th-border)",
        paddingBottom: subtitle || actions ? "1rem" : "0.5rem",
      }}
    >
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <h1
            className="page-header__title text-lg font-bold sm:text-xl truncate"
            style={{ color: "var(--th-text-heading)" }}
          >
            {title}
          </h1>
          {subtitle && (
            <p
              className="page-header__desc mt-1 text-sm"
              style={{ color: "var(--th-text-muted)" }}
            >
              {subtitle}
            </p>
          )}
        </div>
        {actions && <div className="flex flex-1 min-w-0 items-center justify-end gap-2">{actions}</div>}
      </div>
    </header>
  );
}
