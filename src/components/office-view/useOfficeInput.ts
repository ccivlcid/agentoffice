import { useEffect, useRef, useState, useCallback } from "react";
import type { MutableRefObject } from "react";
import { MOBILE_MOVE_CODES } from "./officeViewTypes.ts";
import type { MobileMoveDirection } from "./officeViewTypes.ts";
import { canScrollOnAxis, findScrollContainer } from "./officeViewHelpers.ts";

/* ================================================================== */
/*  Types                                                              */
/* ================================================================== */

export interface UseOfficeInputResult {
  showVirtualPad: boolean;
  showVirtualPadRef: MutableRefObject<boolean>;
  keysRef: MutableRefObject<Record<string, boolean>>;
  scrollHostXRef: MutableRefObject<HTMLElement | null>;
  scrollHostYRef: MutableRefObject<HTMLElement | null>;
  triggerDepartmentInteract: () => void;
  setMoveDirectionPressed: (direction: MobileMoveDirection, pressed: boolean) => void;
  clearVirtualMovement: () => void;
  followCeoInView: () => void;
  attachKeyListeners: (onEnter: () => void) => () => void;
}

export interface UseOfficeInputOptions {
  containerRef: MutableRefObject<HTMLDivElement | null>;
  ceoPosRef: MutableRefObject<{ x: number; y: number }>;
  officeWRef: MutableRefObject<number>;
  totalHRef: MutableRefObject<number>;
  roomRectsRef: MutableRefObject<Array<{ dept: { id: string }; x: number; y: number; w: number; h: number }>>;
  onSelectDepartment: (dept: any) => void;
}

/* ================================================================== */
/*  Hook                                                               */
/* ================================================================== */

export function useOfficeInput(opts: UseOfficeInputOptions): UseOfficeInputResult {
  const { containerRef, ceoPosRef, officeWRef, totalHRef, roomRectsRef, onSelectDepartment } = opts;

  // Wrap callback in a ref so triggerDepartmentInteract stays stable across renders.
  // Without this, inline arrow functions passed from parent (e.g. App.tsx) cause
  // triggerDepartmentInteract to change every render, which in turn causes the
  // Pixi lifecycle useEffect to re-run and destroy/recreate the entire Pixi app,
  // resulting in flickering and animation resets.
  const onSelectDeptRef = useRef(onSelectDepartment);
  onSelectDeptRef.current = onSelectDepartment;

  const [showVirtualPad, setShowVirtualPad] = useState(false);
  const showVirtualPadRef = useRef(showVirtualPad);
  showVirtualPadRef.current = showVirtualPad;

  const keysRef = useRef<Record<string, boolean>>({});
  const scrollHostXRef = useRef<HTMLElement | null>(null);
  const scrollHostYRef = useRef<HTMLElement | null>(null);

  // ── Detect coarse pointer / narrow screen to show virtual pad ──
  useEffect(() => {
    const update = () => {
      const isCoarsePointer = window.matchMedia("(pointer: coarse)").matches;
      setShowVirtualPad(isCoarsePointer || window.innerWidth <= 1024);
    };
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  const setMoveDirectionPressed = useCallback((direction: MobileMoveDirection, pressed: boolean) => {
    for (const code of MOBILE_MOVE_CODES[direction]) {
      keysRef.current[code] = pressed;
    }
  }, []);

  const clearVirtualMovement = useCallback(() => {
    (Object.keys(MOBILE_MOVE_CODES) as MobileMoveDirection[]).forEach((direction) => {
      setMoveDirectionPressed(direction, false);
    });
  }, [setMoveDirectionPressed]);

  // Clear movement when virtual pad is hidden or on unmount
  useEffect(() => { if (!showVirtualPad) clearVirtualMovement(); }, [showVirtualPad, clearVirtualMovement]);
  useEffect(() => () => { clearVirtualMovement(); }, [clearVirtualMovement]);

  const triggerDepartmentInteract = useCallback(() => {
    const cx = ceoPosRef.current.x;
    const cy = ceoPosRef.current.y;
    for (const r of roomRectsRef.current) {
      if (cx >= r.x && cx <= r.x + r.w && cy >= r.y - 10 && cy <= r.y + r.h) {
        onSelectDeptRef.current(r.dept);
        break;
      }
    }
  }, [ceoPosRef, roomRectsRef]);

  // ── Follow CEO in scrollable view (for virtual pad mode) ──
  const followCeoInView = useCallback(() => {
    if (!showVirtualPadRef.current) return;
    const container = containerRef.current;
    if (!container) return;
    const containerRect = container.getBoundingClientRect();
    const scaleX = officeWRef.current > 0 ? container.clientWidth / officeWRef.current : 1;
    const scaleY = totalHRef.current > 0 ? container.clientHeight / totalHRef.current : scaleX;
    let hostX = scrollHostXRef.current;
    if (!hostX || !canScrollOnAxis(hostX, "x")) {
      hostX = findScrollContainer(container, "x") ?? (document.scrollingElement as HTMLElement | null);
      scrollHostXRef.current = hostX;
    }
    let hostY = scrollHostYRef.current;
    if (!hostY || !canScrollOnAxis(hostY, "y")) {
      hostY = findScrollContainer(container, "y") ?? (document.scrollingElement as HTMLElement | null);
      scrollHostYRef.current = hostY;
    }
    let nextLeft: number | null = null, movedX = false;
    if (hostX) {
      const hostRectX = hostX.getBoundingClientRect();
      const ceoInHostX = containerRect.left - hostRectX.left + ceoPosRef.current.x * scaleX;
      const ceoContentX = hostX.scrollLeft + ceoInHostX;
      const targetLeft = ceoContentX - hostX.clientWidth * 0.45;
      const maxLeft = Math.max(0, hostX.scrollWidth - hostX.clientWidth);
      nextLeft = Math.max(0, Math.min(maxLeft, targetLeft));
      movedX = Math.abs(hostX.scrollLeft - nextLeft) > 1;
    }
    let nextTop: number | null = null, movedY = false;
    if (hostY) {
      const hostRectY = hostY.getBoundingClientRect();
      const ceoInHostY = containerRect.top - hostRectY.top + ceoPosRef.current.y * scaleY;
      const ceoContentY = hostY.scrollTop + ceoInHostY;
      const targetTop = ceoContentY - hostY.clientHeight * 0.45;
      const maxTop = Math.max(0, hostY.scrollHeight - hostY.clientHeight);
      nextTop = Math.max(0, Math.min(maxTop, targetTop));
      movedY = Math.abs(hostY.scrollTop - nextTop) > 1;
    }
    if (hostX && hostY && hostX === hostY) {
      if (movedX || movedY) {
        hostX.scrollTo({
          left: movedX && nextLeft !== null ? nextLeft : hostX.scrollLeft,
          top: movedY && nextTop !== null ? nextTop : hostX.scrollTop,
          behavior: "auto",
        });
      }
      return;
    }
    if (hostX && movedX && nextLeft !== null) hostX.scrollTo({ left: nextLeft, top: hostX.scrollTop, behavior: "auto" });
    if (hostY && movedY && nextTop !== null) hostY.scrollTo({ left: hostY.scrollLeft, top: nextTop, behavior: "auto" });
  }, [containerRef, ceoPosRef, officeWRef, totalHRef]);

  // ── Keyboard listener factory (called from main init effect) ──
  const attachKeyListeners = useCallback((onEnter: () => void): (() => void) => {
    const isInputFocused = () => {
      const tag = document.activeElement?.tagName;
      return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" ||
        (document.activeElement as HTMLElement)?.isContentEditable;
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (isInputFocused()) return;
      if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "KeyW", "KeyA", "KeyS", "KeyD"].includes(e.code)) {
        e.preventDefault();
        keysRef.current[e.code] = true;
      }
      if (e.code === "Enter" || e.code === "Space") { e.preventDefault(); onEnter(); }
    };
    const onKeyUp = (e: KeyboardEvent) => {
      if (isInputFocused()) return;
      keysRef.current[e.code] = false;
    };
    const onBlur = () => {
      for (const key of Object.keys(keysRef.current)) keysRef.current[key] = false;
    };
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    window.addEventListener("blur", onBlur);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("blur", onBlur);
    };
  }, []);

  return {
    showVirtualPad,
    showVirtualPadRef,
    keysRef,
    scrollHostXRef,
    scrollHostYRef,
    triggerDepartmentInteract,
    setMoveDirectionPressed,
    clearVirtualMovement,
    followCeoInView,
    attachKeyListeners,
  };
}
