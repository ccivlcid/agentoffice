import { getSubAgentSpriteNum, type TFunction } from "./agentDetailHelpers";
import { UserCheck, Hammer, CheckCircle2 } from "lucide-react";

interface SubAgent {
  id: string;
  parentAgentId: string;
  task: string;
  status: "working" | "done";
}

interface AgentDetailAlbaProps {
  agentSubAgents: SubAgent[];
  t: TFunction;
}

export default function AgentDetailAlba({
  agentSubAgents,
  t,
}: AgentDetailAlbaProps) {
  if (agentSubAgents.length === 0) {
    return (
      <div className="text-center py-8 text-slate-500 text-sm">
        <UserCheck className="mx-auto mb-2 h-8 w-8 text-slate-500" aria-hidden />
        {t({ ko: "현재 알바생이 없습니다", en: "No sub-agents currently" })}
        <div className="text-xs mt-1 text-slate-600">
          {t({
            ko: "병렬 처리 시 자동으로 알바생이 소환됩니다",
            en: "Sub-agents are spawned automatically during parallel work.",
})}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {agentSubAgents.map((s) => (
        <div
          key={s.id}
          className={`bg-slate-700/30 rounded-lg p-3 flex items-center gap-3 ${
            s.status === "working" ? "animate-alba-spawn" : ""
          }`}
        >
          <div className="w-8 h-8 rounded-full bg-amber-500/20 overflow-hidden flex items-center justify-center">
            <img
              src={`/sprites/${getSubAgentSpriteNum(s.id)}-D-1.png`}
              alt={t({ ko: "알바생", en: "Sub-agent" })}
              className="w-full h-full object-cover"
              style={{ imageRendering: "pixelated" }}
            />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-sm text-white truncate flex items-center gap-1.5">
              <span className="text-[10px] px-1 py-0.5 rounded bg-amber-500/20 text-amber-400">
                {t({ ko: "알바", en: "Sub" })}
              </span>
              {s.task}
            </div>
            <div className="text-xs text-slate-500 mt-0.5">
              {s.status === "working"
                ? <><Hammer width={12} height={12} className="inline-block align-middle mr-1 text-amber-400" /> {t({ ko: "작업중...", en: "Working..." })}</>
                : <><CheckCircle2 width={12} height={12} className="inline-block align-middle mr-1 text-green-400" /> {t({ ko: "완료", en: "Done" })}</>}
            </div>
          </div>
          {s.status === "working" && (
            <div className="w-4 h-4 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
          )}
        </div>
      ))}
    </div>
  );
}
