import { useState, useMemo } from "react";
import type { Task, Agent, Department } from "../../types";
import type { TaskStatus } from "../../types";
import { useI18n } from "../../i18n";
import { taskStatusLabel } from "../task-board/taskBoardHelpers";
import DirectiveCard from "./DirectiveCard";
import { Search, SlidersHorizontal, X } from "lucide-react";

interface DirectivesListProps {
  tasks: Task[];
  agents: Agent[];
  departments: Department[];
  selectedTaskId: string | null;
  onSelectTask: (id: string) => void;
}

type SortKey = "newest" | "oldest" | "priority";

export default function DirectivesList({
  tasks,
  agents,
  departments,
  selectedTaskId,
  onSelectTask,
}: DirectivesListProps) {
  const { t } = useI18n();
  const [search, setSearch] = useState("");
  const [filterDept, setFilterDept] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("newest");
  const [showFilters, setShowFilters] = useState(false);

  const filtered = useMemo(() => {
    let list = tasks.filter((t) => !t.hidden);
    if (search) {
      const q = search.toLowerCase();
      list = list.filter((t) => t.title.toLowerCase().includes(q));
    }
    if (filterDept) list = list.filter((t) => t.department_id === filterDept);
    if (filterStatus) list = list.filter((t) => t.status === filterStatus);

    list.sort((a, b) => {
      if (sortKey === "oldest") return a.created_at - b.created_at;
      if (sortKey === "priority") return b.priority - a.priority;
      return b.created_at - a.created_at;
    });
    return list;
  }, [tasks, search, filterDept, filterStatus, sortKey]);

  const hasFilters = Boolean(search || filterDept || filterStatus);
  const statusOptions: TaskStatus[] = ["inbox", "planned", "collaborating", "in_progress", "review", "done", "pending", "cancelled"];

  return (
    <div className="flex flex-col h-full">
      {/* Search */}
      <div className="px-3 py-2 space-y-2" style={{ borderBottom: "1px solid var(--th-border)" }}>
        <div className="flex items-center gap-2">
          <div
            className="flex items-center gap-1.5 flex-1 rounded-md px-2 py-1.5"
            style={{ background: "var(--th-bg-surface)", border: "1px solid var(--th-border)" }}
          >
            <Search width={14} height={14} style={{ color: "var(--th-text-muted)" }} />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t({ ko: "검색...", en: "Search..." })}
              className="flex-1 bg-transparent text-xs outline-none"
              style={{ color: "var(--th-text-primary)" }}
            />
            {search && (
              <button onClick={() => setSearch("")} className="opacity-50 hover:opacity-100">
                <X width={12} height={12} />
              </button>
            )}
          </div>
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`p-1.5 rounded-md transition-colors ${showFilters ? "bg-blue-500/20" : ""}`}
            style={{ color: showFilters ? "var(--th-text-accent)" : "var(--th-text-muted)" }}
          >
            <SlidersHorizontal width={14} height={14} />
          </button>
        </div>

        {showFilters && (
          <div className="flex gap-2 flex-wrap">
            <select
              value={filterDept}
              onChange={(e) => setFilterDept(e.target.value)}
              className="text-[11px] rounded px-1.5 py-1 bg-transparent"
              style={{ border: "1px solid var(--th-border)", color: "var(--th-text-secondary)" }}
            >
              <option value="">{t({ ko: "전체 부서", en: "All Depts" })}</option>
              {departments.map((d) => (
                <option key={d.id} value={d.id}>{d.name_ko || d.name}</option>
              ))}
            </select>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="text-[11px] rounded px-1.5 py-1 bg-transparent"
              style={{ border: "1px solid var(--th-border)", color: "var(--th-text-secondary)" }}
            >
              <option value="">{t({ ko: "전체 상태", en: "All Status" })}</option>
              {statusOptions.map((s) => (
                <option key={s} value={s}>{taskStatusLabel(s, t)}</option>
              ))}
            </select>
            <select
              value={sortKey}
              onChange={(e) => setSortKey(e.target.value as SortKey)}
              className="text-[11px] rounded px-1.5 py-1 bg-transparent"
              style={{ border: "1px solid var(--th-border)", color: "var(--th-text-secondary)" }}
            >
              <option value="newest">{t({ ko: "최신순", en: "Newest" })}</option>
              <option value="oldest">{t({ ko: "오래된순", en: "Oldest" })}</option>
              <option value="priority">{t({ ko: "우선순위순", en: "Priority" })}</option>
            </select>
            {hasFilters && (
              <button
                onClick={() => { setSearch(""); setFilterDept(""); setFilterStatus(""); }}
                className="text-[10px] px-1.5 py-0.5 rounded"
                style={{ color: "var(--th-text-accent)" }}
              >
                {t({ ko: "초기화", en: "Reset" })}
              </button>
            )}
          </div>
        )}
      </div>

      {/* Count */}
      <div className="px-3 py-1.5 text-[10px]" style={{ color: "var(--th-text-muted)" }}>
        {t({ ko: `${filtered.length}건`, en: `${filtered.length} items` })}
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto px-2 pb-2 space-y-1.5">
        {filtered.length === 0 ? (
          <div className="py-8 text-center text-xs" style={{ color: "var(--th-text-muted)" }}>
            {t({ ko: "업무지시가 없습니다.", en: "No directives found." })}
          </div>
        ) : (
          filtered.map((task) => (
            <DirectiveCard
              key={task.id}
              task={task}
              agents={agents}
              departments={departments}
              selected={task.id === selectedTaskId}
              onClick={() => onSelectTask(task.id)}
            />
          ))
        )}
      </div>
    </div>
  );
}
