import type { Agent } from "../../types";
import type { TFunction } from "./agentDetailHelpers";
import { MessageSquare, ClipboardList, Monitor } from "lucide-react";

interface SubAgent {
  id: string;
  parentAgentId: string;
  task: string;
  status: "working" | "done";
}

interface AgentDetailInfoProps {
  agent: Agent;
  xpLevel: number;
  agentSubAgents: SubAgent[];
  t: TFunction;
  onChat: (agent: Agent) => void;
  onAssignTask: (agentId: string) => void;
  onOpenTerminal?: (taskId: string) => void;
}

export default function AgentDetailInfo({
  agent,
  xpLevel,
  agentSubAgents,
  t,
  onChat,
  onAssignTask,
  onOpenTerminal,
}: AgentDetailInfoProps) {
  return (
    <div className="space-y-3">
      <div className="bg-slate-700/30 rounded-lg p-3">
        <div className="text-xs text-slate-500 mb-1">
          {t({ ko: "성격", en: "Personality" })}
        </div>
        <div className="text-sm text-slate-300">
          {agent.personality ??
            t({ ko: "설정 없음", en: "Not set" })}
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2">
        <div className="bg-slate-700/30 rounded-lg p-3 text-center">
          <div className="text-lg font-bold text-white">
            {agent.stats_tasks_done}
          </div>
          <div className="text-[10px] text-slate-500">
            {t({ ko: "완료 업무", en: "Completed" })}
          </div>
        </div>
        <div className="bg-slate-700/30 rounded-lg p-3 text-center">
          <div className="text-lg font-bold text-white">{xpLevel}</div>
          <div className="text-[10px] text-slate-500">{t({ ko: "레벨", en: "Level" })}</div>
        </div>
        <div className="bg-slate-700/30 rounded-lg p-3 text-center">
          <div className="text-lg font-bold text-white">
            {agentSubAgents.filter((s) => s.status === "working").length}
          </div>
          <div className="text-[10px] text-slate-500">
            {t({ ko: "알바생", en: "Sub-agents" })}
          </div>
        </div>
      </div>

      <div className="flex gap-2 pt-2">
        <button
          onClick={() => onChat(agent)}
          className="flex-1 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium transition-colors"
        >
          <MessageSquare width={16} height={16} className="inline-block align-middle mr-1" /> {t({ ko: "대화하기", en: "Chat" })}
        </button>
        <button
          onClick={() => onAssignTask(agent.id)}
          className="flex-1 py-2 rounded-lg bg-purple-600 hover:bg-purple-500 text-white text-sm font-medium transition-colors"
        >
          <ClipboardList width={16} height={16} className="inline-block align-middle mr-1" /> {t({ ko: "업무 배정", en: "Assign Task" })}
        </button>
      </div>
      {agent.status === "working" && agent.current_task_id && onOpenTerminal && (
        <button
          onClick={() => onOpenTerminal(agent.current_task_id!)}
          className="w-full mt-2 py-2 rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-200 text-sm font-medium transition-colors flex items-center justify-center gap-1.5"
        >
          <Monitor width={16} height={16} className="inline-block align-middle" /> {t({ ko: "터미널 보기", en: "View Terminal" })}
        </button>
      )}
    </div>
  );
}
