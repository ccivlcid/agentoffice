import type { ReactNode } from "react";

export interface LoadingBlockProps {
  /** 로딩 문구 */
  message?: string;
  /** 스피너 대신 자식 노드 (스켈레톤 등) */
  children?: ReactNode;
  /** 컨테이너 className */
  className?: string;
}

/**
 * 공통 로딩 블록: 스피너 + 문구 또는 커스텀 자식.
 * 탭·패널·목록 로딩 통일용.
 */
export function LoadingBlock({
  message,
  children,
  className = "",
}: LoadingBlockProps) {
  return (
    <div
      className={`loading-block flex flex-col items-center justify-center gap-4 py-12 px-4 ${className}`.trim()}
      role="status"
      aria-live="polite"
      aria-label={message ?? "Loading"}
    >
      {children ?? (
        <>
          <div
            className="w-8 h-8 border-2 rounded-full animate-spin"
            style={{
              borderColor: "var(--th-border)",
              borderTopColor: "var(--th-focus-ring)",
            }}
          />
          {message && (
            <p
              className="text-sm"
              style={{ color: "var(--th-text-muted)" }}
            >
              {message}
            </p>
          )}
        </>
      )}
    </div>
  );
}
