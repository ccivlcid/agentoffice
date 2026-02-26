import { useState, useCallback, useEffect } from "react";
import type { DeptTheme } from "./OfficeRoomManagerTheme";
import {
  DEFAULT_THEMES,
  DEFAULT_TONE,
  labels,
  deriveTheme,
  inferTone,
  initDeptState,
  type DeptState,
} from "./OfficeRoomManagerTheme";
import OfficeRoomManagerDeptCard from "./OfficeRoomManagerDeptCard";

export interface OfficeRoomManagerProps {
  departments: Array<{ id: string; name: string }>;
  customThemes: Record<string, DeptTheme>;
  onThemeChange: (themes: Record<string, DeptTheme>) => void;
  onActiveDeptChange?: (deptId: string | null) => void;
  onClose: () => void;
  language: "ko" | "en";
}

export default function OfficeRoomManager({
  departments,
  customThemes,
  onThemeChange,
  onActiveDeptChange,
  onClose,
  language,
}: OfficeRoomManagerProps) {
  const [deptStates, setDeptStates] = useState<Record<string, DeptState>>(() => {
    const result: Record<string, DeptState> = {};
    for (const dept of departments) {
      result[dept.id] = initDeptState(dept.id, customThemes);
    }
    return result;
  });

  const buildAndEmit = useCallback(
    (next: Record<string, DeptState>) => {
      const themes: Record<string, DeptTheme> = {};
      for (const [id, s] of Object.entries(next)) {
        themes[id] = deriveTheme(s.accent, s.tone);
      }
      onThemeChange(themes);
    },
    [onThemeChange]
  );

  const updateDept = useCallback(
    (deptId: string, patch: Partial<DeptState>) => {
      setDeptStates((prev) => {
        const next = { ...prev, [deptId]: { ...prev[deptId], ...patch } };
        buildAndEmit(next);
        return next;
      });
    },
    [buildAndEmit]
  );

  const resetDept = useCallback(
    (deptId: string) => {
      const def = DEFAULT_THEMES[deptId];
      if (!def) return;
      const next: DeptState = { accent: def.accent, tone: inferTone(def) };
      setDeptStates((prev) => {
        const updated = { ...prev, [deptId]: next };
        buildAndEmit(updated);
        return updated;
      });
    },
    [buildAndEmit]
  );

  const resetAll = useCallback(() => {
    const next: Record<string, DeptState> = {};
    for (const dept of departments) {
      const def = DEFAULT_THEMES[dept.id];
      next[dept.id] = def
        ? { accent: def.accent, tone: inferTone(def) }
        : { accent: 0x5a9fd4, tone: DEFAULT_TONE };
    }
    setDeptStates(next);
    buildAndEmit(next);
  }, [departments, buildAndEmit]);

  const activateDept = useCallback(
    (deptId: string) => {
      onActiveDeptChange?.(deptId);
    },
    [onActiveDeptChange]
  );

  useEffect(() => () => onActiveDeptChange?.(null), [onActiveDeptChange]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-stretch justify-end"
      style={{ backdropFilter: "blur(2px)", WebkitBackdropFilter: "blur(2px)", backgroundColor: "rgba(0,0,0,0.5)" }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="w-full md:max-w-md bg-slate-900 flex flex-col h-full shadow-2xl border-l border-slate-700">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-700 shrink-0">
          <h2 className="text-base font-semibold text-slate-100">{labels.title[language]}</h2>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-100 transition-colors w-8 h-8 flex items-center justify-center rounded hover:bg-slate-700"
            aria-label={labels.close[language]}
          >
            <svg viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5">
              <path d="M6.28 5.22a.75.75 0 0 0-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 1 0 1.06 1.06L10 11.06l3.72 3.72a.75.75 0 1 0 1.06-1.06L11.06 10l3.72-3.72a.75.75 0 0 0-1.06-1.06L10 8.94 6.28 5.22Z" />
            </svg>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
          {departments.map((dept) => {
            const state = deptStates[dept.id] ?? { accent: 0x5a9fd4, tone: DEFAULT_TONE };
            return (
              <OfficeRoomManagerDeptCard
                key={dept.id}
                deptId={dept.id}
                deptName={dept.name}
                state={state}
                language={language}
                onActivate={() => activateDept(dept.id)}
                onAccentChange={(accent) => updateDept(dept.id, { accent })}
                onToneChange={(tone) => updateDept(dept.id, { tone })}
                onReset={() => resetDept(dept.id)}
              />
            );
          })}
        </div>

        <div className="px-4 py-4 border-t border-slate-700 shrink-0 flex gap-2">
          <button
            onClick={resetAll}
            className="flex-1 py-2 rounded-md text-sm font-medium bg-slate-700 text-slate-200 hover:bg-slate-600 transition-colors"
          >
            {labels.resetAll[language]}
          </button>
          <button
            onClick={onClose}
            className="flex-1 py-2 rounded-md text-sm font-medium bg-slate-600 text-slate-100 hover:bg-slate-500 transition-colors"
          >
            {labels.close[language]}
          </button>
        </div>
      </div>
    </div>
  );
}
