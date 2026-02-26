import { useEffect, useRef, useCallback, useState } from "react";
import { Application, Texture, Assets, TextureStyle } from "pixi.js";
import type { Container, Graphics } from "pixi.js";
import type { CliUsageEntry } from "../../api";
import type { UiLanguage } from "../../i18n.ts";
import type { ThemeMode } from "../../ThemeContext.ts";
import type { OfficeViewProps, Delivery, RoomRect, WallClockVisual, SubCloneBurstParticle, MobileMoveDirection } from "./officeViewTypes.ts";
import { MIN_OFFICE_W, CEO_SPEED, DELIVERY_SPEED, CEO_SIZE, TARGET_CHAR_H,
  SUB_CLONE_WAVE_SPEED, SUB_CLONE_MOVE_X_AMPLITUDE, SUB_CLONE_MOVE_Y_AMPLITUDE,
  SUB_CLONE_FLOAT_DRIFT, SUB_CLONE_FIREWORK_INTERVAL } from "./officeViewConstants.ts";
import { findScrollContainer, destroyNode, hashStr, blendColor } from "./officeViewHelpers.ts";
import { applyWallClockTime } from "./officeViewDrawing.ts";
import { emitSubCloneFireworkBurst } from "./officeViewParticles.ts";
import { buildOfficeScene } from "./officeViewScene.ts";
import { runAnimationTick } from "./officeViewAnimTick.ts";
import type { SubCloneAnimItem } from "./officeViewAgentTick.ts";
import { useOfficeInput } from "./useOfficeInput.ts";
import { useOfficeDeliveryEffects } from "./officeViewDeliveryEffects.ts";

export interface UseOfficePixiResult {
  canvasContainerRef: React.RefObject<HTMLDivElement | null>;
  showVirtualPad: boolean;
  triggerDepartmentInteract: () => void;
  setMoveDirectionPressed: (direction: MobileMoveDirection, pressed: boolean) => void;
  clearVirtualMovement: () => void;
  setCliUsageRef: (usage: Record<string, CliUsageEntry> | null) => void;
}

type UseOfficePixiProps = OfficeViewProps & {
  language: UiLanguage;
  currentTheme: ThemeMode;
};

export function useOfficePixi(props: UseOfficePixiProps): UseOfficePixiResult {
  const { language, currentTheme } = props;
  const themeRef = useRef<ThemeMode>(currentTheme);
  themeRef.current = currentTheme;
  const containerRef = useRef<HTMLDivElement>(null);
  const appRef = useRef<Application | null>(null);
  const texturesRef = useRef<Record<string, Texture>>({});
  const destroyedRef = useRef(false);
  const initIdRef = useRef(0);
  const initDoneRef = useRef(false);
  const [sceneRevision, setSceneRevision] = useState(0);
  const tickRef = useRef(0);
  const ceoPosRef = useRef({ x: 180, y: 60 });
  const ceoSpriteRef = useRef<Container | null>(null);
  const crownRef = useRef<Graphics | null>(null);
  const highlightRef = useRef<Graphics | null>(null);
  const animItemsRef = useRef<Array<{
    sprite: Container; status: string;
    baseX: number; baseY: number; particles: Container;
    agentId?: string; cliProvider?: string;
    deskG?: Graphics; bedG?: Graphics; blanketG?: Graphics;
  }>>([]);
  const cliUsageRef = useRef<Record<string, CliUsageEntry> | null>(null);
  const roomRectsRef = useRef<RoomRect[]>([]);
  const deliveriesRef = useRef<Delivery[]>([]);
  const deliveryLayerRef = useRef<Container | null>(null);
  const prevAssignRef = useRef<Set<string>>(new Set());
  const agentPosRef = useRef<Map<string, { x: number; y: number }>>(new Map());
  const processedCrossDeptRef = useRef<Set<string>>(new Set());
  const processedCeoOfficeRef = useRef<Set<string>>(new Set());
  const spriteMapRef = useRef<Map<string, number>>(new Map());
  const ceoMeetingSeatsRef = useRef<Array<{ x: number; y: number }>>([]);
  const totalHRef = useRef(600);
  const officeWRef = useRef(MIN_OFFICE_W);
  const ceoOfficeRectRef = useRef<{ x: number; y: number; w: number; h: number } | null>(null);
  const breakRoomRectRef = useRef<{ x: number; y: number; w: number; h: number } | null>(null);
  const breakAnimItemsRef = useRef<Array<{ sprite: Container; baseX: number; baseY: number }>>([]);
  const subCloneAnimItemsRef = useRef<SubCloneAnimItem[]>([]);
  const subCloneBurstParticlesRef = useRef<SubCloneBurstParticle[]>([]);
  const subCloneSnapshotRef = useRef<Map<string, { parentAgentId: string; x: number; y: number }>>(new Map());
  const breakSteamParticlesRef = useRef<Container | null>(null);
  const breakBubblesRef = useRef<Container[]>([]);
  const wallClocksRef = useRef<WallClockVisual[]>([]);
  const wallClockSecondRef = useRef(-1);
  const localeRef = useRef(language);
  localeRef.current = language;
  const themeHighlightTargetIdRef = useRef<string | null>(props.themeHighlightTargetId ?? null);
  themeHighlightTargetIdRef.current = props.themeHighlightTargetId ?? null;
  const dataRef = useRef({
    departments: props.departments, agents: props.agents, tasks: props.tasks,
    subAgents: props.subAgents, unreadAgentIds: props.unreadAgentIds,
    meetingPresence: props.meetingPresence, customDeptThemes: props.customDeptThemes,
  });
  dataRef.current = {
    departments: props.departments, agents: props.agents, tasks: props.tasks,
    subAgents: props.subAgents, unreadAgentIds: props.unreadAgentIds,
    meetingPresence: props.meetingPresence, customDeptThemes: props.customDeptThemes,
  };
  const cbRef = useRef({ onSelectAgent: props.onSelectAgent, onSelectDepartment: props.onSelectDepartment });
  cbRef.current = { onSelectAgent: props.onSelectAgent, onSelectDepartment: props.onSelectDepartment };
  const activeMeetingTaskIdRef = useRef<string | null>(props.activeMeetingTaskId ?? null);
  activeMeetingTaskIdRef.current = props.activeMeetingTaskId ?? null;
  const meetingMinutesOpenRef = useRef(props.onOpenActiveMeetingMinutes);
  meetingMinutesOpenRef.current = props.onOpenActiveMeetingMinutes;

  const setCliUsageRef = useCallback((usage: Record<string, CliUsageEntry> | null) => {
    cliUsageRef.current = usage;
  }, []);

  // ── Input sub-hook ──
  const input = useOfficeInput({
    containerRef,
    ceoPosRef,
    officeWRef,
    totalHRef,
    roomRectsRef,
    onSelectDepartment: props.onSelectDepartment,
  });

  const buildScene = useCallback(() => {
    // Stop the ticker while rebuilding to prevent partial frames being rendered
    const wasRunning = appRef.current?.ticker?.started ?? false;
    if (wasRunning) appRef.current!.ticker.stop();
    try {
      buildOfficeScene({
        appRef, texturesRef, dataRef, ceoPosRef, ceoSpriteRef, crownRef, highlightRef,
        animItemsRef, roomRectsRef, deliveriesRef, deliveryLayerRef, prevAssignRef,
        agentPosRef, spriteMapRef, ceoMeetingSeatsRef, totalHRef, officeWRef,
        ceoOfficeRectRef, breakRoomRectRef, breakAnimItemsRef, subCloneAnimItemsRef,
        subCloneBurstParticlesRef, subCloneSnapshotRef, breakSteamParticlesRef,
        breakBubblesRef, wallClocksRef, wallClockSecondRef, localeRef, themeRef,
        themeHighlightTargetIdRef, activeMeetingTaskIdRef, meetingMinutesOpenRef, cbRef,
        setSceneRevision,
      });
    } catch (e) {
      console.error("[OfficeView buildScene]", e);
    }
    if (wasRunning) appRef.current!.ticker.start();
  }, []);

  // ── Pixi application lifecycle ──
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    destroyedRef.current = false;
    const currentInitId = ++initIdRef.current;
    input.scrollHostXRef.current = findScrollContainer(el, "x");
    input.scrollHostYRef.current = findScrollContainer(el, "y");

    async function init() {
      if (!el) return;
      TextureStyle.defaultOptions.scaleMode = "nearest";
      officeWRef.current = Math.max(MIN_OFFICE_W, el.clientWidth);
      const app = new Application();
      await app.init({
        width: officeWRef.current, height: 600,
        background: 0x0c0c18,  // opaque corridor color; updated per-theme in buildOfficeScene
        antialias: false, resolution: Math.min(window.devicePixelRatio || 1, 2), autoDensity: true,
      });
      if (initIdRef.current !== currentInitId) { app.destroy(); return; }
      appRef.current = app;
      const canvas = app.canvas as HTMLCanvasElement;
      canvas.style.imageRendering = "pixelated";
      el.innerHTML = "";
      el.appendChild(canvas);
      const textures: Record<string, Texture> = {};
      const loads: Promise<void>[] = [];
      for (let i = 1; i <= 13; i++) {
        for (const f of [1, 2, 3]) {
          const key = `${i}-D-${f}`;
          loads.push(Assets.load<Texture>(`/sprites/${key}.png`).then(t => { textures[key] = t; }).catch(() => {}));
        }
        for (const dir of ["L", "R"]) {
          const key = `${i}-${dir}-1`;
          loads.push(Assets.load<Texture>(`/sprites/${key}.png`).then(t => { textures[key] = t; }).catch(() => {}));
        }
      }
      loads.push(Assets.load<Texture>("/sprites/ceo-lobster.png").then(t => { textures["ceo"] = t; }).catch(() => {}));
      await Promise.all(loads);
      if (initIdRef.current !== currentInitId) { app.destroy(); return; }
      texturesRef.current = textures;
      buildScene();
      initDoneRef.current = true;
      input.followCeoInView();
      app.ticker.add(() => {
        if (destroyedRef.current || appRef.current !== app) return;
        try {
          runAnimationTick({
            tickRef, keysRef: input.keysRef, ceoPosRef, ceoSpriteRef, crownRef, highlightRef,
            officeWRef, totalHRef, roomRectsRef, breakRoomRectRef, ceoOfficeRectRef,
            animItemsRef, subCloneAnimItemsRef, subCloneBurstParticlesRef, breakAnimItemsRef,
            breakSteamParticlesRef, breakBubblesRef, wallClocksRef, wallClockSecondRef,
            deliveriesRef, cliUsageRef, dataRef, themeHighlightTargetIdRef,
            followCeoInView: input.followCeoInView,
            hashStr, destroyNode, applyWallClockTime, blendColor,
            CEO_SPEED,
            DELIVERY_SPEED, TARGET_CHAR_H, CEO_SIZE, SUB_CLONE_WAVE_SPEED,
            SUB_CLONE_MOVE_X_AMPLITUDE, SUB_CLONE_MOVE_Y_AMPLITUDE,
            SUB_CLONE_FLOAT_DRIFT, SUB_CLONE_FIREWORK_INTERVAL,
            emitSubCloneFireworkBurst,
          });
        } catch (e) {
          // Prevent a single tick error from killing the entire animation loop
          console.error("[OfficeView tick]", e);
        }
      });
    }

    const detachKeys = input.attachKeyListeners(input.triggerDepartmentInteract);
    init();

    const ro = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry || !appRef.current || destroyedRef.current || initIdRef.current !== currentInitId) return;
      const newW = Math.max(MIN_OFFICE_W, Math.floor(entry.contentRect.width));
      if (Math.abs(newW - officeWRef.current) > 10) { officeWRef.current = newW; buildScene(); }
    });
    ro.observe(el);

    return () => {
      destroyedRef.current = true;
      initIdRef.current++;
      ro.disconnect();
      detachKeys();
      deliveriesRef.current = [];
      initDoneRef.current = false;
      input.scrollHostXRef.current = null;
      input.scrollHostYRef.current = null;
      if (appRef.current) { appRef.current.destroy(true, { children: true }); appRef.current = null; }
      // Bust Pixi's global asset cache so the next init() (e.g. React StrictMode
      // double-mount) gets fresh GPU textures instead of stale references.
      const resetPromise = Assets.reset();
      if (resetPromise != null && typeof (resetPromise as Promise<unknown>).catch === "function") {
        (resetPromise as Promise<void>).catch(() => {});
      }
    };
    // input.followCeoInView, input.attachKeyListeners, input.triggerDepartmentInteract
    // are stable useCallback references — safe to include individually
  }, [buildScene, input.followCeoInView, input.attachKeyListeners, input.triggerDepartmentInteract]);

  // Structural keys — compared by value so array/Set reference changes don't cause
  // unnecessary scene rebuilds on every poll cycle.
  // Agent *status* changes are intentionally excluded: the ticker reads dataRef.current live.
  const agentStructureKey = props.agents
    .filter((a: any) => !a.disabled)
    .map((a: any) => a.id)
    .sort()
    .join(",");
  const deptStructureKey = props.departments
    .map((d: any) => d.id)
    .sort()
    .join(",");
  // Sub-agents: track IDs only — status changes are handled live by the animation tick
  // via dataRef, so including status here would cause unnecessary full scene rebuilds
  const subAgentsKey = (props.subAgents as any[])
    .map((s: any) => s.id)
    .sort()
    .join(",");
  // Unread: Set may be new reference every render — convert to stable string
  const unreadKey = [...(props.unreadAgentIds ?? [])].sort().join(",");
  // customDeptThemes: object may be new reference every render — serialize to stable string
  const customDeptThemesKey = props.customDeptThemes
    ? JSON.stringify(props.customDeptThemes)
    : "";

  // Re-build scene when structural data changes
  useEffect(() => {
    if (initDoneRef.current && appRef.current) buildScene();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [agentStructureKey, deptStructureKey, subAgentsKey, unreadKey,
      language, props.activeMeetingTaskId, customDeptThemesKey, currentTheme, buildScene]);

  // Sync agent statuses into animItemsRef without rebuilding the scene.
  // This keeps "working" sparkles, "offline" fade, and CLI util states live
  // even when the scene is not rebuilt (structural key hasn't changed).
  useEffect(() => {
    animItemsRef.current.forEach((item) => {
      if (item.agentId) {
        const agent = props.agents.find((a: any) => a.id === item.agentId);
        if (agent) item.status = agent.status ?? "idle";
      }
    });
  }, [props.agents]);

  // ── Delivery / meeting effects sub-hook ──
  useOfficeDeliveryEffects(
    {
      meetingPresence: props.meetingPresence,
      crossDeptDeliveries: props.crossDeptDeliveries,
      onCrossDeptDeliveryProcessed: props.onCrossDeptDeliveryProcessed,
      ceoOfficeCalls: props.ceoOfficeCalls,
      onCeoOfficeCallProcessed: props.onCeoOfficeCallProcessed,
      agents: props.agents,
    },
    { deliveryLayerRef, texturesRef, deliveriesRef, ceoMeetingSeatsRef, spriteMapRef, agentPosRef, processedCrossDeptRef, processedCeoOfficeRef },
    language,
    sceneRevision,
  );

  return {
    canvasContainerRef: containerRef,
    showVirtualPad: input.showVirtualPad,
    triggerDepartmentInteract: input.triggerDepartmentInteract,
    setMoveDirectionPressed: input.setMoveDirectionPressed,
    clearVirtualMovement: input.clearVirtualMovement,
    setCliUsageRef,
  };
}
