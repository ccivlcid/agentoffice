import { useLayoutEffect, useRef } from "react";

const FOCUSABLE =
  'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';

/**
 * 모달/패널 열릴 때 첫 포커스 이동, 닫을 때 이전 포커스 복귀.
 * containerRef는 모달 내부 컨테이너(포커스할 영역)를 가리켜야 함.
 */
export function useModalFocus(isOpen: boolean, containerRef: React.RefObject<HTMLElement | null>) {
  const prevFocusRef = useRef<HTMLElement | null>(null);

  useLayoutEffect(() => {
    if (!isOpen) return;
    prevFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const first = containerRef.current?.querySelector<HTMLElement>(FOCUSABLE);
    first?.focus();
    return () => {
      prevFocusRef.current?.focus();
      prevFocusRef.current = null;
    };
  }, [isOpen, containerRef]);
}
