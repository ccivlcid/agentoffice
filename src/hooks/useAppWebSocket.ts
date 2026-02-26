import { useEffect, useCallback } from "react";
import type { Agent, Task, Message, CompanyStats, SubTask, MeetingPresence, MeetingReviewDecision } from "../types";
import type { TaskReportDetail } from "../api";
import * as api from "../api";
import type { DecisionInboxItem } from "../components/chat/decision-inbox";
import {
  appendCapped,
  MAX_LIVE_MESSAGES, MAX_LIVE_SUBTASKS, MAX_LIVE_SUBAGENTS,
  MAX_CROSS_DEPT_DELIVERIES, MAX_CEO_OFFICE_CALLS,
} from "../appHelpers";
import { areAgentsEquivalent, areAgentListsEquivalent, areTaskListsEquivalent } from "../appEquality";
import type { SubAgent, CrossDeptDelivery, CeoOfficeCall } from "../appHelpers";
import { buildCliOutputHandler } from "./useCliOutputHandler";
import type { useWebSocket } from "./useWebSocket";

export type UseAppWebSocketParams = {
  agentsRef: React.RefObject<Agent[]>;
  tasksRef: React.RefObject<Task[]>;
  subAgentsRef: React.RefObject<SubAgent[]>;
  activeChatRef: React.RefObject<{ showChat: boolean; agentId: string | null }>;
  viewRef: React.RefObject<string>;
  codexThreadToSubAgentIdRef: React.RefObject<Map<string, string>>;
  codexThreadBindingTsRef: React.RefObject<Map<string, number>>;
  subAgentStreamTailRef: React.RefObject<Map<string, string>>;
  liveSyncInFlightRef: React.RefObject<boolean>;
  liveSyncQueuedRef: React.RefObject<boolean>;
  liveSyncTimerRef: React.RefObject<ReturnType<typeof setTimeout> | null>;
  on: ReturnType<typeof useWebSocket>["on"];
  setAgents: React.Dispatch<React.SetStateAction<Agent[]>>;
  setTasks: React.Dispatch<React.SetStateAction<Task[]>>;
  setStats: React.Dispatch<React.SetStateAction<CompanyStats | null>>;
  setSubAgents: React.Dispatch<React.SetStateAction<SubAgent[]>>;
  setSubtasks: React.Dispatch<React.SetStateAction<SubTask[]>>;
  setMeetingPresence: React.Dispatch<React.SetStateAction<MeetingPresence[]>>;
  setDecisionInboxItems: React.Dispatch<React.SetStateAction<DecisionInboxItem[]>>;
  setMessages: React.Dispatch<React.SetStateAction<Message[]>>;
  setUnreadAgentIds: React.Dispatch<React.SetStateAction<Set<string>>>;
  setCrossDeptDeliveries: React.Dispatch<React.SetStateAction<CrossDeptDelivery[]>>;
  setCeoOfficeCalls: React.Dispatch<React.SetStateAction<CeoOfficeCall[]>>;
  setTaskReport: React.Dispatch<React.SetStateAction<TaskReportDetail | null>>;
  setStreamingMessage: React.Dispatch<React.SetStateAction<{
    message_id: string; agent_id: string; agent_name: string;
    agent_avatar: string; content: string;
  } | null>>;
};

export function useAppWebSocket(p: UseAppWebSocketParams) {
  const {
    agentsRef, tasksRef, subAgentsRef, activeChatRef, viewRef,
    codexThreadToSubAgentIdRef, codexThreadBindingTsRef, subAgentStreamTailRef,
    liveSyncInFlightRef, liveSyncQueuedRef, liveSyncTimerRef, on,
    setAgents, setTasks, setStats, setSubAgents, setSubtasks,
    setMeetingPresence, setDecisionInboxItems, setMessages, setUnreadAgentIds,
    setCrossDeptDeliveries, setCeoOfficeCalls, setTaskReport, setStreamingMessage,
  } = p;

  const runLiveSync = useCallback(() => {
    if (liveSyncInFlightRef.current) { liveSyncQueuedRef.current = true; return; }
    liveSyncInFlightRef.current = true;
    Promise.all([api.getTasks(), api.getAgents(), api.getStats(), api.getDecisionInbox()])
      .then(([nextTasks, nextAgents, nextStats, nextDecisionItems]) => {
        setTasks((prev) => (areTaskListsEquivalent(prev, nextTasks) ? prev : nextTasks));
        setAgents((prev) => (areAgentListsEquivalent(prev, nextAgents) ? prev : nextAgents));
        setStats(nextStats);
        setDecisionInboxItems((prev) => {
          const preserved = prev.filter((item) => item.kind === "agent_request");
          const workflow: DecisionInboxItem[] = nextDecisionItems.map((item) => ({
            id: item.id, kind: item.kind, agentId: item.agent_id ?? null,
            agentName: item.kind === "project_review_ready"
              ? (item.agent_name || item.project_name || item.project_id || "Planning Lead")
              : (item.task_title || item.task_id || "Task"),
            agentNameKo: item.kind === "project_review_ready"
              ? (item.agent_name_ko || item.agent_name || item.project_name || item.project_id || "기획팀장")
              : (item.task_title || item.task_id || "작업"),
            agentAvatar: item.agent_avatar ?? (item.kind === "project_review_ready" ? "user" : null),
            requestContent: item.summary,
            options: item.options.map((o) => ({ number: o.number, label: o.label ?? o.action, action: o.action })),
            createdAt: item.created_at, taskId: item.task_id,
            projectId: item.project_id, projectName: item.project_name,
          }));
          const deduped = new Map<string, DecisionInboxItem>();
          for (const e of [...workflow, ...preserved]) deduped.set(e.id, e);
          return Array.from(deduped.values()).sort((a, b) => b.createdAt - a.createdAt);
        });
      })
      .catch(console.error)
      .finally(() => {
        liveSyncInFlightRef.current = false;
        if (!liveSyncQueuedRef.current) return;
        liveSyncQueuedRef.current = false;
        setTimeout(() => runLiveSync(), 120);
      });
  }, [setAgents, setTasks, setStats, setDecisionInboxItems]);

  const scheduleLiveSync = useCallback((delayMs = 120) => {
    if (liveSyncTimerRef.current) return;
    liveSyncTimerRef.current = setTimeout(() => {
      liveSyncTimerRef.current = null;
      runLiveSync();
    }, Math.max(0, delayMs));
  }, [runLiveSync]);

  useEffect(() => {
    const cliOutputHandler = buildCliOutputHandler({
      agentsRef, tasksRef, subAgentsRef,
      codexThreadToSubAgentIdRef, codexThreadBindingTsRef, subAgentStreamTailRef,
      setSubAgents,
    });
    const unsubs = [
      on("task_update", () => { scheduleLiveSync(80); }),
      on("agent_status", (payload: unknown) => {
        const pld = payload as Agent & { subAgents?: SubAgent[] };
        const { subAgents: incomingSubs, ...agentPatch } = pld;
        if (!agentsRef.current.some((a) => a.id === agentPatch.id)) { scheduleLiveSync(80); return; }
        setAgents((prev) => {
          const idx = prev.findIndex((a) => a.id === agentPatch.id);
          if (idx < 0) return prev;
          const merged = { ...prev[idx], ...agentPatch };
          if (areAgentsEquivalent(prev[idx], merged)) return prev;
          const next = [...prev]; next[idx] = merged; return next;
        });
        if (incomingSubs) {
          setSubAgents((prev) => {
            const others = prev.filter((s) => s.parentAgentId !== pld.id);
            const next = [...others, ...incomingSubs];
            return next.length > MAX_LIVE_SUBAGENTS ? next.slice(next.length - MAX_LIVE_SUBAGENTS) : next;
          });
        }
      }),
      on("new_message", (payload: unknown) => {
        const msg = payload as Message;
        setMessages((prev) => {
          if (prev.some((m) => m.id === msg.id)) return prev;
          return appendCapped(prev, msg, MAX_LIVE_MESSAGES);
        });
        if (msg.sender_type === "agent" && msg.sender_id) {
          const { showChat, agentId } = activeChatRef.current;
          if (showChat && agentId === msg.sender_id) return;
          setUnreadAgentIds((prev) => {
            if (prev.has(msg.sender_id!)) return prev;
            const next = new Set(prev); next.add(msg.sender_id!); return next;
          });
        }
      }),
      on("announcement", (payload: unknown) => {
        const msg = payload as Message;
        setMessages((prev) => {
          if (prev.some((m) => m.id === msg.id)) return prev;
          return appendCapped(prev, msg, MAX_LIVE_MESSAGES);
        });
        if (msg.sender_type === "agent" && msg.sender_id) {
          const { showChat, agentId } = activeChatRef.current;
          if (showChat && agentId === msg.sender_id) return;
          setUnreadAgentIds((prev) => {
            if (prev.has(msg.sender_id!)) return prev;
            const next = new Set(prev); next.add(msg.sender_id!); return next;
          });
        }
      }),
      on("task_report", (payload: unknown) => {
        const pld = payload as { task?: { id?: string } } | null;
        const rid = typeof pld?.task?.id === "string" ? pld.task.id : null;
        if (!rid) { setTaskReport(payload as TaskReportDetail); return; }
        api.getTaskReportDetail(rid).then((d) => setTaskReport(d))
          .catch(() => setTaskReport(payload as TaskReportDetail));
      }),
      on("cross_dept_delivery", (payload: unknown) => {
        const pld = payload as { from_agent_id: string; to_agent_id: string };
        setCrossDeptDeliveries((prev) => appendCapped(prev, {
          id: `cd-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          fromAgentId: pld.from_agent_id, toAgentId: pld.to_agent_id,
        }, MAX_CROSS_DEPT_DELIVERIES));
      }),
      on("ceo_office_call", (payload: unknown) => {
        const pld = payload as {
          from_agent_id: string; seat_index?: number; phase?: "kickoff" | "review";
          action?: "arrive" | "speak" | "dismiss"; line?: string;
          decision?: MeetingReviewDecision; task_id?: string; hold_until?: number;
        };
        if (!pld.from_agent_id) return;
        const action = pld.action ?? "arrive";
        if (action === "arrive" || action === "speak") {
          setMeetingPresence((prev) => {
            const ex = prev.find((r) => r.agent_id === pld.from_agent_id);
            const rest = prev.filter((r) => r.agent_id !== pld.from_agent_id);
            const until = action === "arrive"
              ? (pld.hold_until ?? ex?.until ?? (Date.now() + 600_000))
              : (ex?.until ?? (Date.now() + 600_000));
            return [...rest, {
              decision: (pld.phase ?? ex?.phase ?? "kickoff") === "review"
                ? (pld.decision ?? ex?.decision ?? "reviewing") : null,
              agent_id: pld.from_agent_id,
              seat_index: pld.seat_index ?? ex?.seat_index ?? 0,
              phase: pld.phase ?? ex?.phase ?? "kickoff",
              task_id: pld.task_id ?? ex?.task_id ?? null, until,
            }];
          });
        } else if (action === "dismiss") {
          setMeetingPresence((prev) => prev.filter((r) => r.agent_id !== pld.from_agent_id));
        }
        setCeoOfficeCalls((prev) => appendCapped(prev, {
          id: `ceo-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          fromAgentId: pld.from_agent_id, seatIndex: pld.seat_index ?? 0,
          phase: pld.phase ?? "kickoff", action, line: pld.line,
          decision: pld.decision, taskId: pld.task_id, holdUntil: pld.hold_until,
          instant: action === "arrive" && viewRef.current !== "office",
        }, MAX_CEO_OFFICE_CALLS));
      }),
      on("subtask_update", (payload: unknown) => {
        const st = payload as SubTask;
        setSubtasks((prev) => {
          const idx = prev.findIndex((s) => s.id === st.id);
          if (idx >= 0) { const next = [...prev]; next[idx] = st; return next; }
          return appendCapped(prev, st, MAX_LIVE_SUBTASKS);
        });
        scheduleLiveSync(160);
      }),
      on("cli_output", cliOutputHandler),
      on("chat_stream", (payload: unknown) => {
        const pld = payload as {
          phase: "start" | "delta" | "end"; message_id: string; agent_id: string;
          agent_name?: string; agent_avatar?: string; text?: string;
          content?: string; created_at?: number;
        };
        if (pld.phase === "start") {
          setStreamingMessage({
            message_id: pld.message_id, agent_id: pld.agent_id,
            agent_name: pld.agent_name ?? "", agent_avatar: pld.agent_avatar ?? "", content: "",
          });
        } else if (pld.phase === "delta") {
          setStreamingMessage((prev) => {
            if (!prev || prev.message_id !== pld.message_id) return prev;
            return { ...prev, content: prev.content + (pld.text ?? "") };
          });
        } else if (pld.phase === "end") {
          setStreamingMessage(null);
          if (pld.content && pld.message_id) {
            const msg: Message = {
              id: pld.message_id, sender_type: "agent", sender_id: pld.agent_id,
              receiver_type: "agent", receiver_id: null, content: pld.content,
              message_type: "chat", task_id: null, created_at: pld.created_at ?? Date.now(),
            };
            setMessages((prev) => {
              if (prev.some((m) => m.id === msg.id)) return prev;
              return appendCapped(prev, msg, MAX_LIVE_MESSAGES);
            });
          }
        }
      }),
    ];
    return () => unsubs.forEach((fn) => fn());
  }, [on, scheduleLiveSync]);

  useEffect(() => {
    let timer: ReturnType<typeof setInterval>;
    function start() { timer = setInterval(() => scheduleLiveSync(0), 5000); }
    function handleVis() {
      clearInterval(timer);
      if (!document.hidden) { scheduleLiveSync(0); start(); }
    }
    start();
    document.addEventListener("visibilitychange", handleVis);
    return () => { clearInterval(timer); document.removeEventListener("visibilitychange", handleVis); };
  }, [scheduleLiveSync]);

  useEffect(() => {
    return () => {
      if (!liveSyncTimerRef.current) return;
      clearTimeout(liveSyncTimerRef.current);
      liveSyncTimerRef.current = null;
    };
  }, []);

  return { scheduleLiveSync };
}
