import { useState, useMemo } from "react";
import type { Task, Agent, Department } from "../../types";
import { useI18n } from "../../i18n";
import { EmptyState } from "../ui";
import DeliverableCard from "./DeliverableCard";
import { Search, X, Package, Send } from "lucide-react";

export type PeriodFilter = "all" | "today" | "week" | "month";

function getPeriodStart(period: PeriodFilter): number {
  const now = Date.now();
  const d = new Date(now);
  if (period === "today") {
    d.setHours(0, 0, 0, 0);
    return d.getTime();
  }
  if (period === "week") {
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1);
    d.setDate(diff);
    d.setHours(0, 0, 0, 0);
    return d.getTime();
  }
  if (period === "month") {
    d.setDate(1);
    d.setHours(0, 0, 0, 0);
    return d.getTime();
  }
  return 0;
}

interface DeliverablesListProps {
  tasks: Task[];
  agents: Agent[];
  departments: Department[];
  selectedTaskId: string | null;
  onSelectTask: (id: string) => void;
  onNavigateToDirectives?: () => void;
}

export default function DeliverablesList({
  tasks,
  agents,
  departments,
  selectedTaskId,
  onSelectTask,
  onNavigateToDirectives,
}: DeliverablesListProps) {
  const { t, locale } = useI18n();
  const [search, setSearch] = useState("");
  const [filterDept, setFilterDept] = useState("");
  const [period, setPeriod] = useState<PeriodFilter>("all");

  const completedTasks = useMemo(() => {
    let list = tasks.filter(
      (task) => task.status === "done" || task.status === "review",
    );
    if (period !== "all") {
      const since = getPeriodStart(period);
      list = list.filter((task) => {
        const ts = task.completed_at ?? task.updated_at;
        return ts >= since;
      });
    }
    if (search) {
      const q = search.toLowerCase();
      list = list.filter((task) =>
        task.title.toLowerCase().includes(q) ||
        (task.description ?? "").toLowerCase().includes(q),
      );
    }
    if (filterDept) list = list.filter((task) => task.department_id === filterDept);
    list.sort((a, b) => (b.completed_at ?? b.updated_at) - (a.completed_at ?? a.updated_at));
    return list;
  }, [tasks, search, filterDept, period]);

  return (
    <div className="flex flex-col h-full">
      <div className="dlv-list-header">
        <div className="dlv-list-header-top">
          <span className="dlv-list-label">
            {t({ ko: "완료 목록", en: "Completed" })}
          </span>
          <span className="dlv-count" aria-label={`${completedTasks.length} items`}>
            {completedTasks.length}
          </span>
        </div>

        <div className="dlv-search">
          <Search width={14} height={14} className="dlv-search-icon" aria-hidden />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t({ ko: "제목·내용 검색", en: "Search title or content" })}
            className="dlv-search-input"
            aria-label={t({ ko: "검색", en: "Search" })}
          />
          {search && (
            <button
              type="button"
              onClick={() => setSearch("")}
              className="dlv-search-clear"
              aria-label={t({ ko: "검색 지우기", en: "Clear search" })}
            >
              <X width={12} height={12} />
            </button>
          )}
        </div>

        <div className="dlv-period-row">
          {(
            [
              { key: "all" as const, label: t({ ko: "전체", en: "All" }) },
              { key: "today" as const, label: t({ ko: "오늘", en: "Today" }) },
              { key: "week" as const, label: t({ ko: "이번 주", en: "This week" }) },
              { key: "month" as const, label: t({ ko: "이번 달", en: "This month" }) },
            ] as const
          ).map(({ key, label }) => (
            <button
              key={key}
              type="button"
              className={`dlv-period-pill ${period === key ? "dlv-period-pill--active" : ""}`}
              onClick={() => setPeriod(key)}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="dlv-filter-row">
          <button
            type="button"
            className={`dlv-filter-pill ${!filterDept ? "dlv-filter-pill--active" : ""}`}
            onClick={() => setFilterDept("")}
          >
            {t({ ko: "전체 부서", en: "All depts" })}
          </button>
          {departments.map((d) => (
            <button
              key={d.id}
              type="button"
              className={`dlv-filter-pill ${filterDept === d.id ? "dlv-filter-pill--active" : ""}`}
              onClick={() => setFilterDept(filterDept === d.id ? "" : d.id)}
            >
              {locale === "ko" ? d.name_ko || d.name : d.name}
            </button>
          ))}
        </div>
      </div>

      <div className="dlv-list-body">
        {completedTasks.length === 0 ? (
          <EmptyState
            icon={<Package width={24} height={24} strokeWidth={1.5} />}
            title={
              search || filterDept || period !== "all"
                ? t({ ko: "조건에 맞는 결과가 없습니다", en: "No results match your filters" })
                : t({ ko: "완료된 결과물이 없습니다", en: "No completed deliverables yet" })
            }
            action={
              !search && !filterDept && period === "all" && onNavigateToDirectives ? (
                <button
                  type="button"
                  onClick={onNavigateToDirectives}
                  className="btn-primary btn-sm"
                >
                  <Send width={12} height={12} />
                  {t({ ko: "업무지시에서 작업하기", en: "Create in Directives" })}
                </button>
              ) : undefined
            }
            className="py-6"
          />
        ) : (
          <ul className="dlv-card-list" role="list">
            {completedTasks.map((task) => (
              <li key={task.id}>
                <DeliverableCard
                  task={task}
                  agents={agents}
                  departments={departments}
                  selected={task.id === selectedTaskId}
                  onClick={() => onSelectTask(task.id)}
                />
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
