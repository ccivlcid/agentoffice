import { useState, useCallback } from "react";
import { DndContext, DragOverlay, type DragStartEvent, type DragEndEvent } from "@dnd-kit/core";
import type { Department, Agent, Task, MeetingPresence } from "../../../types";
import type { LangText } from "../../../i18n";
import DeptCard from "./DeptCard";
import BreakRoomCard from "./BreakRoomCard";
import AgentRow from "./AgentRow";

interface OfficeGridProps {
  departments: Department[];
  agents: Agent[];
  tasks: Task[];
  unreadAgentIds: Set<string>;
  meetingPresence?: MeetingPresence[];
  t: (obj: LangText) => string;
  onSelectAgent: (agent: Agent) => void;
  onSelectDepartment: (dept: Department) => void;
  onHireAgent?: () => void;
  onMoveAgent?: (agentId: string, targetDeptId: string | null) => void;
}

export default function OfficeGrid({
  departments,
  agents,
  tasks,
  unreadAgentIds,
  meetingPresence,
  t,
  onSelectAgent,
  onSelectDepartment,
  onHireAgent,
  onMoveAgent,
}: OfficeGridProps) {
  const [activeAgentId, setActiveAgentId] = useState<string | null>(null);
  const isDraggable = !!onMoveAgent;

  const handleDragStart = useCallback((event: DragStartEvent) => {
    setActiveAgentId(event.active.id as string);
  }, []);

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      setActiveAgentId(null);
      const { active, over } = event;
      if (!over || !onMoveAgent) return;
      const agentId = active.id as string;
      const currentDeptId = active.data.current?.currentDeptId ?? null;
      const targetDeptId = (over.data.current?.deptId as string | null) ?? null;
      if (currentDeptId === targetDeptId) return;
      onMoveAgent(agentId, targetDeptId);
    },
    [onMoveAgent],
  );

  const handleDragCancel = useCallback(() => setActiveAgentId(null), []);
  const activeAgent = activeAgentId ? agents.find((a) => a.id === activeAgentId) : null;

  return (
    <DndContext onDragStart={handleDragStart} onDragEnd={handleDragEnd} onDragCancel={handleDragCancel}>
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {departments.map((dept) => (
          <DeptCard
            key={dept.id}
            department={dept}
            agents={agents}
            tasks={tasks}
            unreadAgentIds={unreadAgentIds}
            meetingPresence={meetingPresence}
            t={t}
            onSelectAgent={onSelectAgent}
            onSelectDepartment={onSelectDepartment}
            draggable={isDraggable}
          />
        ))}
        <BreakRoomCard
          departments={departments}
          agents={agents}
          tasks={tasks}
          unreadAgentIds={unreadAgentIds}
          meetingPresence={meetingPresence}
          t={t}
          onSelectAgent={onSelectAgent}
          onHireAgent={onHireAgent}
          draggable={isDraggable}
        />
      </div>
      <DragOverlay dropAnimation={null}>
        {activeAgent && (
          <div className="w-72 rounded-xl bg-slate-800/90 shadow-xl shadow-slate-950/40 ring-1 ring-cyan-400/30 backdrop-blur-sm">
            <AgentRow agent={activeAgent} agents={agents} taskCount={0} hasUnread={false} t={t} onSelect={() => {}} />
          </div>
        )}
      </DragOverlay>
    </DndContext>
  );
}
