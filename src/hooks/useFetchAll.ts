import { useCallback } from "react";
import * as api from "../api";
import type { Agent, Task, CompanyStats, SubTask, MeetingPresence, CompanySettings, Department } from "../types";
import type { DecisionInboxItem } from "../components/chat/decision-inbox";
import type { RoomThemeMap } from "../appHelpers";
import {
  mergeSettingsWithDefaults,
  isRoomThemeMap,
  readStoredClientLanguage,
  isUserLanguagePinned,
  syncClientLanguage,
  ROOM_THEMES_STORAGE_KEY,
} from "../appHelpers";
import { detectBrowserLanguage } from "../i18n";
import { DEFAULT_SETTINGS } from "../types";

type FetchAllSetters = {
  setDepartments: React.Dispatch<React.SetStateAction<Department[]>>;
  setAgents: React.Dispatch<React.SetStateAction<Agent[]>>;
  setTasks: React.Dispatch<React.SetStateAction<Task[]>>;
  setStats: React.Dispatch<React.SetStateAction<CompanyStats | null>>;
  setSettings: React.Dispatch<React.SetStateAction<CompanySettings>>;
  setSubtasks: React.Dispatch<React.SetStateAction<SubTask[]>>;
  setMeetingPresence: React.Dispatch<React.SetStateAction<MeetingPresence[]>>;
  setDecisionInboxItems: React.Dispatch<React.SetStateAction<DecisionInboxItem[]>>;
  setLoading: React.Dispatch<React.SetStateAction<boolean>>;
  setCustomRoomThemes?: React.Dispatch<React.SetStateAction<RoomThemeMap>>;
};

type FetchAllRefs = {
  hasLocalRoomThemesRef: React.MutableRefObject<boolean>;
  initialRoomThemes: { themes: RoomThemeMap; hasStored: boolean };
};

export function useFetchAll(setters: FetchAllSetters, refs: FetchAllRefs) {
  const {
    setDepartments, setAgents, setTasks, setStats, setSettings,
    setSubtasks, setMeetingPresence, setDecisionInboxItems, setLoading,
    setCustomRoomThemes,
  } = setters;
  const { hasLocalRoomThemesRef, initialRoomThemes } = refs;

  return useCallback(async () => {
    try {
      const [depts, ags, tks, sts, sett, subs, presence, decisionItems] = await Promise.all([
        api.getDepartments(), api.getAgents(), api.getTasks(), api.getStats(),
        api.getSettings(), api.getActiveSubtasks(),
        api.getMeetingPresence().catch(() => []),
        api.getDecisionInbox().catch(() => []),
      ]);
      setDepartments(depts);
      setAgents(ags);
      setTasks(tks);
      setStats(sts);

      const mergedSettings = mergeSettingsWithDefaults(sett);
      const autoDetectedLanguage = detectBrowserLanguage();
      const storedClientLanguage = readStoredClientLanguage();
      const shouldAutoAssignLanguage =
        !isUserLanguagePinned() && !storedClientLanguage
        && mergedSettings.language === DEFAULT_SETTINGS.language;
      const nextSettings = shouldAutoAssignLanguage
        ? { ...mergedSettings, language: autoDetectedLanguage }
        : mergedSettings;
      setSettings(nextSettings);
      syncClientLanguage(nextSettings.language);

      const dbRoomThemes = isRoomThemeMap(nextSettings.roomThemes)
        ? nextSettings.roomThemes as RoomThemeMap : undefined;

      if (!hasLocalRoomThemesRef.current && dbRoomThemes && Object.keys(dbRoomThemes).length > 0) {
        if (setCustomRoomThemes) setCustomRoomThemes(dbRoomThemes);
        hasLocalRoomThemesRef.current = true;
        try {
          window.localStorage.setItem(ROOM_THEMES_STORAGE_KEY, JSON.stringify(dbRoomThemes));
        } catch { /* ignore quota errors */ }
      }
      if (
        hasLocalRoomThemesRef.current && Object.keys(initialRoomThemes.themes).length > 0 &&
        (!dbRoomThemes || Object.keys(dbRoomThemes).length === 0)
      ) {
        api.saveRoomThemes(initialRoomThemes.themes).catch((error) => {
          console.error("Room theme sync to DB failed:", error);
        });
      }
      if (shouldAutoAssignLanguage && mergedSettings.language !== autoDetectedLanguage) {
        api.saveSettings(nextSettings).catch((error) => {
          console.error("Auto language sync failed:", error);
        });
      }

      setSubtasks(subs);
      setMeetingPresence(presence);
      setDecisionInboxItems(
        (decisionItems ?? []).map((item) => ({
          id: item.id,
          kind: item.kind,
          agentId: item.agent_id ?? null,
          agentName: item.kind === "project_review_ready"
            ? (item.agent_name || item.project_name || item.project_id || "Planning Lead")
            : (item.task_title || item.task_id || "Task"),
          agentNameKo: item.kind === "project_review_ready"
            ? (item.agent_name_ko || item.agent_name || item.project_name || item.project_id || "기획팀장")
            : (item.task_title || item.task_id || "작업"),
          agentAvatar: item.agent_avatar ?? (item.kind === "project_review_ready" ? "user" : null),
          requestContent: item.summary,
          options: item.options.map((option) => ({
            number: option.number,
            label: option.label ?? option.action,
            action: option.action,
          })),
          createdAt: item.created_at,
          taskId: item.task_id,
          projectId: item.project_id,
          projectName: item.project_name,
        })),
      );
    } catch (e) {
      console.error("Failed to fetch data:", e);
    } finally {
      setLoading(false);
    }
  }, [
    setDepartments, setAgents, setTasks, setStats, setSettings,
    setSubtasks, setMeetingPresence, setDecisionInboxItems, setLoading,
    setCustomRoomThemes,
  ]);
}
