import type { ReactNode } from "react";

export interface EmptyStateProps {
  /** 아이콘 (Lucide 등) */
  icon: ReactNode;
  /** 제목 */
  title: string;
  /** 설명 문구 */
  description?: string;
  /** CTA 버튼/링크 (선택) */
  action?: ReactNode;
  /** 컨테이너 className */
  className?: string;
}

/**
 * 공통 빈 상태: 아이콘 + 제목 + 설명 + 선택 CTA.
 * 목록/상세/탭 빈 상태 통일용.
 */
export function EmptyState({
  icon,
  title,
  description,
  action,
  className = "",
}: EmptyStateProps) {
  return (
    <div
      className={`empty-state flex flex-col items-center justify-center gap-3 py-8 px-4 text-center ${className}`.trim()}
      role="status"
      aria-label={title}
    >
      <div
        className="empty-state__icon w-12 h-12 rounded-xl flex items-center justify-center shrink-0"
        style={{
          background: "var(--th-bg-surface)",
          color: "var(--th-text-muted)",
        }}
      >
        {icon}
      </div>
      <p
        className="empty-state__title text-sm font-semibold"
        style={{ color: "var(--th-text-primary)" }}
      >
        {title}
      </p>
      {description && (
        <p
          className="empty-state__desc text-xs max-w-sm"
          style={{ color: "var(--th-text-muted)" }}
        >
          {description}
        </p>
      )}
      {action && <div className="empty-state__action mt-1">{action}</div>}
    </div>
  );
}
