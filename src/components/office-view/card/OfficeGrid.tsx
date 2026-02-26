import type { Department, Agent, Task } from "../../../types";
import type { LangText } from "../../../i18n";
import DeptCard from "./DeptCard";
import BreakRoomCard from "./BreakRoomCard";

interface OfficeGridProps {
  departments: Department[];
  agents: Agent[];
  tasks: Task[];
  unreadAgentIds: Set<string>;
  t: (obj: LangText) => string;
  onSelectAgent: (agent: Agent) => void;
  onSelectDepartment: (dept: Department) => void;
  onHireAgent?: () => void;
}

export default function OfficeGrid({
  departments,
  agents,
  tasks,
  unreadAgentIds,
  t,
  onSelectAgent,
  onSelectDepartment,
  onHireAgent,
}: OfficeGridProps) {
  return (
    <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
      {departments.map((dept) => (
        <DeptCard
          key={dept.id}
          department={dept}
          agents={agents}
          tasks={tasks}
          unreadAgentIds={unreadAgentIds}
          t={t}
          onSelectAgent={onSelectAgent}
          onSelectDepartment={onSelectDepartment}
        />
      ))}
      <BreakRoomCard
        departments={departments}
        agents={agents}
        tasks={tasks}
        unreadAgentIds={unreadAgentIds}
        t={t}
        onSelectAgent={onSelectAgent}
        onHireAgent={onHireAgent}
      />
    </div>
  );
}
