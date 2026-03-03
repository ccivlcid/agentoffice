// @ts-nocheck

import fs from "node:fs";
import path from "node:path";
import { randomUUID, createHash } from "node:crypto";
import type { Lang } from "../../../types/lang.ts";
import type { AgentRow } from "./agent-types.ts";
import { l, pickL } from "./agent-types.ts";
import type { DelegationOptions } from "./directive-policy.ts";
import { normalizeTextField, buildRoundGoal } from "./directive-policy.ts";

// ---------------------------------------------------------------------------
// shouldTreatDirectChatAsTask, createDirectAgentTaskAndRun, scheduleAgentReply
// ---------------------------------------------------------------------------

export function initializeDirectChat(deps: {
  db: any;
  nowMs: () => number;
  broadcast: any;
  logsDir: string;
  resolveLang: (text?: string, fallback?: Lang) => Lang;
  randomDelay: (min: number, max: number) => number;
  getDeptName: (deptId: string) => string;
  sendAgentMessage: any;
  appendTaskLog: any;
  recordTaskCreationAudit: any;
  isTaskWorkflowInterrupted: (taskId: string) => boolean;
  startTaskExecutionForAgent: any;
  resolveProjectFromOptions: any;
  detectProjectPath: any;
  resolveProjectPath: any;
  buildDirectReplyPrompt: any;
  runAgentOneShot: any;
  chooseSafeReply: any;
  executeApiProviderAgent: any;
  executeCopilotAgent: any;
  executeAntigravityAgent: any;
  buildCliFailureMessage: any;
  handleTaskDelegation: (teamLeader: AgentRow, ceoMessage: string, ceoMsgId: string, options?: DelegationOptions) => void;
}) {
  const {
    db, nowMs, broadcast, logsDir, resolveLang, randomDelay, getDeptName,
    sendAgentMessage, appendTaskLog, recordTaskCreationAudit, isTaskWorkflowInterrupted,
    startTaskExecutionForAgent, resolveProjectFromOptions, detectProjectPath, resolveProjectPath,
    buildDirectReplyPrompt, runAgentOneShot, chooseSafeReply, executeApiProviderAgent,
    executeCopilotAgent, executeAntigravityAgent, buildCliFailureMessage, handleTaskDelegation,
  } = deps;

  /**
   * Register a messenger_route so task status notifications relay back to the originating session.
   * If taskId is provided, links directly. Otherwise uses content_hash for later matching.
   */
  function registerMessengerRouteIfNeeded(ceoMessage: string, options: any, taskId?: string): void {
    const sessionKey = options?.messengerSessionKey;
    const author = options?.messengerAuthor;
    if (!sessionKey) return;
    // Hash both full content AND short title so either lookup path can match
    const title = ceoMessage.trim();
    const shortTitle = title.length > 60 ? title.slice(0, 57) + "..." : title;
    const contentHash = createHash("sha256").update(shortTitle).digest("hex").slice(0, 32);
    try {
      db.prepare(
        `INSERT OR IGNORE INTO messenger_routes (id, task_id, content_hash, source, author, session_key, created_at)
         VALUES (?, ?, ?, 'telegram', ?, ?, ?)`,
      ).run(randomUUID(), taskId ?? null, contentHash, author ?? "", sessionKey, Date.now());
    } catch { /* ignore */ }
  }

  /**
   * Lightweight pre-filter: only catches explicit task prefixes.
   * The real task/chat classification is done by the agent via [TASK] marker in the response.
   */
  function shouldTreatDirectChatAsTask(ceoMessage: string, messageType: string): boolean {
    if (messageType === "task_assign") return true;
    if (messageType === "report") return false;
    const text = ceoMessage.trim();
    if (!text) return false;
    if (/^\[(의사결정\s*회신|decision\s*reply|意思決定返信|决策回复)\]/i.test(text)) return false;
    // Only explicit task prefix triggers task flow pre-agent
    if (/^\s*(task|todo|업무|지시|작업|할일)\s*[:\-]/i.test(text)) return true;
    return false;
  }

  function createDirectAgentTaskAndRun(agent: AgentRow, ceoMessage: string, options: DelegationOptions = {}): void {
    const lang = resolveLang(ceoMessage);
    const taskId = randomUUID();
    const t = nowMs();
    const taskTitle = ceoMessage.length > 60 ? ceoMessage.slice(0, 57) + "..." : ceoMessage;
    const selectedProject = resolveProjectFromOptions(options);
    const projectContextHint = normalizeTextField(options.projectContext) || selectedProject.coreGoal;
    const detectedPath = detectProjectPath(options.projectPath || selectedProject.projectPath || ceoMessage) || selectedProject.projectPath;
    const roundGoal = buildRoundGoal(selectedProject.coreGoal, ceoMessage);
    const deptId = agent.department_id ?? null;
    const deptName = deptId ? getDeptName(deptId) : "Unassigned";
    const descriptionLines = [`[CEO DIRECT] ${ceoMessage}`];
    if (selectedProject.name) descriptionLines.push(`[PROJECT] ${selectedProject.name}`);
    if (selectedProject.coreGoal) descriptionLines.push(`[PROJECT CORE GOAL] ${selectedProject.coreGoal}`);
    descriptionLines.push(`[ROUND GOAL] ${roundGoal}`);
    if (projectContextHint && projectContextHint !== selectedProject.coreGoal) {
      descriptionLines.push(`[PROJECT CONTEXT] ${projectContextHint}`);
    }
    db.prepare(`
      INSERT INTO tasks (id, title, description, department_id, assigned_agent_id, project_id, status, priority, task_type, project_path, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, 'planned', 1, 'general', ?, ?, ?)
    `).run(taskId, taskTitle, descriptionLines.join("\n"), deptId, agent.id, selectedProject.id, detectedPath, t, t);
    recordTaskCreationAudit({
      taskId, taskTitle, taskStatus: "planned", departmentId: deptId, assignedAgentId: agent.id,
      taskType: "general", projectPath: detectedPath ?? null, trigger: "workflow.direct_agent_task",
      triggerDetail: "direct chat escalated to task", actorType: "agent", actorId: agent.id, actorName: agent.name,
      body: { ceo_message: ceoMessage, message_type: "task_assign", project_id: selectedProject.id, project_context: projectContextHint, round_goal: roundGoal },
    });
    if (selectedProject.id) {
      db.prepare("UPDATE projects SET last_used_at = ?, updated_at = ? WHERE id = ?").run(t, t, selectedProject.id);
    }
    db.prepare("UPDATE agents SET current_task_id = ? WHERE id = ?").run(taskId, agent.id);
    appendTaskLog(taskId, "system", `Direct CEO assignment to ${agent.name}: ${ceoMessage}`);
    appendTaskLog(taskId, "system", `Round goal: ${roundGoal}`);
    if (selectedProject.id) appendTaskLog(taskId, "system", `Project linked: ${selectedProject.name || selectedProject.id}`);
    if (detectedPath) appendTaskLog(taskId, "system", `Project path detected from direct chat: ${detectedPath}`);

    const ack = pickL(l(
      ["지시 확인했습니다. 바로 작업으로 등록하고 착수하겠습니다."],
      ["Understood. I will register this as a task and start right away."],
      ["指示を確認しました。タスクとして登録し、すぐ着手します。"],
      ["已确认指示。我会先登记任务并立即开始执行。"],
    ), lang);
    sendAgentMessage(agent, ack, "task_assign", "agent", null, taskId);
    broadcast("task_update", db.prepare("SELECT * FROM tasks WHERE id = ?").get(taskId));
    broadcast("agent_status", db.prepare("SELECT * FROM agents WHERE id = ?").get(agent.id));

    setTimeout(() => {
      if (isTaskWorkflowInterrupted(taskId)) return;
      startTaskExecutionForAgent(taskId, agent, deptId, deptName);
    }, randomDelay(900, 1600));
  }

  function scheduleAgentReply(agentId: string, ceoMessage: string, messageType: string, options: DelegationOptions = {}): void {
    const agent = db.prepare("SELECT * FROM agents WHERE id = ?").get(agentId) as AgentRow | undefined;
    if (!agent) return;

    if (agent.status === "offline") {
      const lang = resolveLang(ceoMessage);
      sendAgentMessage(agent, buildCliFailureMessage(agent, lang, "offline"));
      return;
    }

    const useTaskFlow = shouldTreatDirectChatAsTask(ceoMessage, messageType);
    console.log(`[scheduleAgentReply] useTaskFlow=${useTaskFlow}, messageType=${messageType}, msg="${ceoMessage.slice(0, 50)}"`);
    if (useTaskFlow) {
      if (agent.role === "team_leader" && agent.department_id) {
        handleTaskDelegation(agent, ceoMessage, "", options);
      } else {
        createDirectAgentTaskAndRun(agent, ceoMessage, options);
      }
      return;
    }

    // Messenger path: minimal delay for faster response; web UI: longer delay for natural feel
    const isMessenger = Boolean(options?.messengerSessionKey);
    const delay = isMessenger ? 200 + Math.random() * 300 : 1000 + Math.random() * 2000;
    setTimeout(() => {
      void (async () => {
        const activeTask = agent.current_task_id
          ? db.prepare("SELECT title, description, project_path FROM tasks WHERE id = ?").get(agent.current_task_id) as {
            title: string; description: string | null; project_path: string | null;
          } | undefined
          : undefined;
        const detectedPath = detectProjectPath(ceoMessage);
        const projectPath = detectedPath || (activeTask ? resolveProjectPath(activeTask) : process.cwd());
        const built = buildDirectReplyPrompt(agent, ceoMessage, messageType);

        console.log(`[scheduleAgentReply] agent=${agent.name}, cli_provider=${agent.cli_provider}, api_provider_id=${agent.api_provider_id}, api_model=${agent.api_model}`);

        if (agent.cli_provider === "api" && agent.api_provider_id) {
          const msgId = randomUUID();
          broadcast("chat_stream", { phase: "start", message_id: msgId, agent_id: agent.id, agent_name: agent.name, agent_avatar: agent.avatar_emoji ?? "🤖" });
          let fullText = "";
          let apiError = "";
          try {
            const logStream = fs.createWriteStream(path.join(logsDir, `direct-${agent.id}-${Date.now()}.log`), { flags: "w" });
            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), 180_000);
            try {
              await executeApiProviderAgent(built.prompt, projectPath, logStream, controller.signal, undefined, agent.api_provider_id, agent.api_model ?? null, (text: string) => {
                fullText += text; logStream.write(text);
                broadcast("chat_stream", { phase: "delta", message_id: msgId, agent_id: agent.id, text });
                return true;
              });
            } finally { clearTimeout(timeout); logStream.end(); }
          } catch (err: any) {
            apiError = err?.message || String(err);
            console.error(`[scheduleAgentReply:API] Error for ${agent.name}:`, apiError);
          }
          const contentOnly = fullText.replace(/^\[api:[^\]]*\][^\n]*\n---\n/g, "").replace(/\n---\n\[api:[^\]]*\]\s*Done\.\s*$/g, "").trim();
          let finalReply: string;
          if (contentOnly) { finalReply = contentOnly.length > 12000 ? contentOnly.slice(0, 12000) : contentOnly; }
          else if (apiError) { finalReply = `[API Error] ${apiError}`; }
          else { finalReply = chooseSafeReply({ text: "" }, built.lang, "direct", agent); }
          // Agent classified as task → escalate
          if (/^\[TASK\]/m.test(contentOnly || fullText)) {
            const cleanReply = finalReply.replace(/^\[TASK\]\s*/i, "").trim();
            broadcast("chat_stream", { phase: "end", message_id: msgId, agent_id: agent.id, content: cleanReply, created_at: nowMs() });
            if (cleanReply) sendAgentMessage(agent, cleanReply);
            registerMessengerRouteIfNeeded(ceoMessage, options);
            if (agent.role === "team_leader" && agent.department_id) { handleTaskDelegation(agent, ceoMessage, "", options); }
            else { createDirectAgentTaskAndRun(agent, ceoMessage, options); }
            return;
          }
          const endedAt = nowMs();
          db.prepare(`INSERT INTO messages (id, sender_type, sender_id, receiver_type, receiver_id, content, message_type, task_id, created_at) VALUES (?, 'agent', ?, 'agent', NULL, ?, 'chat', NULL, ?)`)
            .run(msgId, agent.id, finalReply, endedAt);
          broadcast("chat_stream", { phase: "end", message_id: msgId, agent_id: agent.id, content: finalReply, created_at: endedAt });
          return;
        }

        if (agent.cli_provider === "copilot" || agent.cli_provider === "antigravity") {
          const msgId = randomUUID();
          broadcast("chat_stream", { phase: "start", message_id: msgId, agent_id: agent.id, agent_name: agent.name, agent_avatar: agent.avatar_emoji ?? "🤖" });
          let fullText = "";
          let oauthError = "";
          try {
            const logStream = fs.createWriteStream(path.join(logsDir, `direct-${agent.id}-${Date.now()}.log`), { flags: "w" });
            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), 180_000);
            const streamCb = (text: string) => {
              fullText += text; logStream.write(text);
              broadcast("chat_stream", { phase: "delta", message_id: msgId, agent_id: agent.id, text });
              return true;
            };
            try {
              if (agent.cli_provider === "copilot") {
                await executeCopilotAgent(built.prompt, projectPath, logStream, controller.signal, undefined, agent.oauth_account_id ?? null, streamCb);
              } else {
                await executeAntigravityAgent(built.prompt, logStream, controller.signal, undefined, agent.oauth_account_id ?? null, streamCb);
              }
            } finally { clearTimeout(timeout); logStream.end(); }
          } catch (err: any) {
            oauthError = err?.message || String(err);
            console.error(`[scheduleAgentReply:OAuth] Error for ${agent.name}:`, oauthError);
          }
          const contentOnly = fullText.replace(/^\[(copilot|antigravity)\][^\n]*\n/gm, "").replace(/---+/g, "").replace(/^\[oauth[^\]]*\][^\n]*/gm, "").trim();
          let finalReply: string;
          if (contentOnly) { finalReply = contentOnly.length > 12000 ? contentOnly.slice(0, 12000) : contentOnly; }
          else if (oauthError) { finalReply = `[OAuth Error] ${oauthError}`; }
          else { finalReply = chooseSafeReply({ text: "" }, built.lang, "direct", agent); }
          // Agent classified as task → escalate
          if (/^\[TASK\]/m.test(contentOnly || fullText)) {
            const cleanReply = finalReply.replace(/^\[TASK\]\s*/i, "").trim();
            broadcast("chat_stream", { phase: "end", message_id: msgId, agent_id: agent.id, content: cleanReply, created_at: nowMs() });
            if (cleanReply) sendAgentMessage(agent, cleanReply);
            registerMessengerRouteIfNeeded(ceoMessage, options);
            if (agent.role === "team_leader" && agent.department_id) { handleTaskDelegation(agent, ceoMessage, "", options); }
            else { createDirectAgentTaskAndRun(agent, ceoMessage, options); }
            return;
          }
          const endedAt = nowMs();
          db.prepare(`INSERT INTO messages (id, sender_type, sender_id, receiver_type, receiver_id, content, message_type, task_id, created_at) VALUES (?, 'agent', ?, 'agent', NULL, ?, 'chat', NULL, ?)`)
            .run(msgId, agent.id, finalReply, endedAt);
          broadcast("chat_stream", { phase: "end", message_id: msgId, agent_id: agent.id, content: finalReply, created_at: endedAt });
          return;
        }

        const run = await runAgentOneShot(agent, built.prompt, { projectPath, rawOutput: true });
        if (!run.text?.trim()) {
          console.warn(`[scheduleAgentReply] Empty one-shot response from ${agent.name} (${agent.cli_provider})${run.error ? `: ${run.error}` : ""}`);
        }
        const reply = chooseSafeReply(run, built.lang, "direct", agent);

        // Agent decided this is a task → escalate to task flow
        // Check both raw one-shot output and normalized reply for [TASK] marker
        const rawReply = (run.text || "").trim();
        const hasTaskMarker = /\[TASK\]/i.test(rawReply) || /\[TASK\]/i.test(reply);
        if (hasTaskMarker) {
          const cleanedReply = reply.replace(/^\[TASK\]\s*/i, "").trim();
          if (cleanedReply) sendAgentMessage(agent, cleanedReply);
          console.log(`[scheduleAgentReply] Agent ${agent.name} classified as TASK, escalating: "${ceoMessage.slice(0, 50)}"`);
          registerMessengerRouteIfNeeded(ceoMessage, options);
          if (agent.role === "team_leader" && agent.department_id) {
            handleTaskDelegation(agent, ceoMessage, "", options);
          } else {
            createDirectAgentTaskAndRun(agent, ceoMessage, options);
          }
          return;
        }

        sendAgentMessage(agent, reply);
      })();
    }, delay);
  }

  return { scheduleAgentReply };
}
