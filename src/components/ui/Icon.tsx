/**
 * lucide 아이콘 래퍼 — 사이즈 체계(xs/sm/md/lg/xl) 및 스타일 일관 적용
 * UI개편기획서 §3 아이콘 사이즈 체계
 */

import type { LucideIcon } from "lucide-react";

export type IconSize = "xs" | "sm" | "md" | "lg" | "xl";

const SIZE_MAP: Record<IconSize, number> = {
  xs: 14,
  sm: 16,
  md: 18,
  lg: 20,
  xl: 24,
};

export interface IconProps {
  icon: LucideIcon;
  size?: IconSize;
  className?: string;
  "aria-hidden"?: boolean;
  "aria-label"?: string;
}

/**
 * 일관된 크기/스타일의 아이콘 렌더링
 * - 인라인 텍스트: xs | 버튼/라벨: sm | 네비: md | 헤더 액션: lg | 페이지 타이틀: xl
 */
export function Icon({
  icon: LucideComp,
  size = "sm",
  className,
  "aria-hidden": ariaHidden,
  "aria-label": ariaLabel,
}: IconProps) {
  const px = SIZE_MAP[size];
  return (
    <LucideComp
      width={px}
      height={px}
      className={className}
      aria-hidden={ariaHidden ?? (ariaLabel ? false : true)}
      aria-label={ariaLabel}
    />
  );
}
