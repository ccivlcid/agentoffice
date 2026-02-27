import { useState, useCallback } from "react";
import type { Agent, Department } from "../../types";
import type { TaskType } from "../../types";
import { useI18n } from "../../i18n";
import {
  TASK_TYPE_OPTIONS,
  taskTypeLabel,
  priorityColor,
} from "../task-board/taskBoardHelpers";
import { Send, Star, X } from "lucide-react";

interface DirectiveFormProps {
  agents: Agent[];
  departments: Department[];
  onSubmit: (input: {
    title: string;
    description?: string;
    department_id?: string;
    task_type?: string;
    priority?: number;
    assigned_agent_id?: string;
  }) => Promise<void>;
  onCancel: () => void;
}

export default function DirectiveForm({
  agents,
  departments,
  onSubmit,
  onCancel,
}: DirectiveFormProps) {
  const { t, locale } = useI18n();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [departmentId, setDepartmentId] = useState("");
  const [taskType, setTaskType] = useState<TaskType>("general");
  const [priority, setPriority] = useState(3);
  const [assignAgentId, setAssignAgentId] = useState("");
  const [busy, setBusy] = useState(false);

  const filteredAgents = departmentId
    ? agents.filter((a) => a.department_id === departmentId)
    : agents;

  const handleSubmit = useCallback(async () => {
    if (!title.trim() || busy) return;
    setBusy(true);
    try {
      await onSubmit({
        title: title.trim(),
        description: description.trim() || undefined,
        department_id: departmentId || undefined,
        task_type: taskType,
        priority,
        assigned_agent_id: assignAgentId || undefined,
      });
      setTitle("");
      setDescription("");
      setDepartmentId("");
      setTaskType("general");
      setPriority(3);
      setAssignAgentId("");
    } finally {
      setBusy(false);
    }
  }, [title, description, departmentId, taskType, priority, assignAgentId, busy, onSubmit]);

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div
        className="flex items-center justify-between px-4 py-3"
        style={{ borderBottom: "1px solid var(--th-border)" }}
      >
        <h3 className="text-sm font-bold" style={{ color: "var(--th-text-heading)" }}>
          {t({ ko: "새 업무지시", en: "New Directive" })}
        </h3>
        <button onClick={onCancel} className="p-1 rounded hover:bg-[var(--th-bg-surface-hover)]">
          <X width={16} height={16} style={{ color: "var(--th-text-muted)" }} />
        </button>
      </div>

      {/* Form */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-4">
        {/* Title */}
        <div>
          <label className="block text-[11px] font-medium mb-1" style={{ color: "var(--th-text-secondary)" }}>
            {t({ ko: "제목 *", en: "Title *" })}
          </label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder={t({ ko: "업무 제목을 입력하세요", en: "Enter directive title" })}
            className="w-full rounded-md px-3 py-2 text-sm bg-transparent outline-none focus:ring-1 focus:ring-blue-500/50"
            style={{ border: "1px solid var(--th-border)", color: "var(--th-text-primary)" }}
          />
        </div>

        {/* Description */}
        <div>
          <label className="block text-[11px] font-medium mb-1" style={{ color: "var(--th-text-secondary)" }}>
            {t({ ko: "설명", en: "Description" })}
          </label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            placeholder={t({ ko: "상세 내용 (선택)", en: "Details (optional)" })}
            className="w-full rounded-md px-3 py-2 text-sm bg-transparent outline-none resize-none focus:ring-1 focus:ring-blue-500/50"
            style={{ border: "1px solid var(--th-border)", color: "var(--th-text-primary)" }}
          />
        </div>

        {/* Department */}
        <div>
          <label className="block text-[11px] font-medium mb-1" style={{ color: "var(--th-text-secondary)" }}>
            {t({ ko: "부서", en: "Department" })}
          </label>
          <select
            value={departmentId}
            onChange={(e) => {
              setDepartmentId(e.target.value);
              setAssignAgentId("");
            }}
            className="w-full rounded-md px-3 py-2 text-sm bg-transparent outline-none"
            style={{ border: "1px solid var(--th-border)", color: "var(--th-text-primary)" }}
          >
            <option value="">{t({ ko: "-- 선택 --", en: "-- Select --" })}</option>
            {departments.map((d) => (
              <option key={d.id} value={d.id}>
                {locale === "ko" ? d.name_ko || d.name : d.name}
              </option>
            ))}
          </select>
        </div>

        {/* Task Type */}
        <div>
          <label className="block text-[11px] font-medium mb-1" style={{ color: "var(--th-text-secondary)" }}>
            {t({ ko: "유형", en: "Type" })}
          </label>
          <select
            value={taskType}
            onChange={(e) => setTaskType(e.target.value as TaskType)}
            className="w-full rounded-md px-3 py-2 text-sm bg-transparent outline-none"
            style={{ border: "1px solid var(--th-border)", color: "var(--th-text-primary)" }}
          >
            {TASK_TYPE_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {taskTypeLabel(opt.value, t)}
              </option>
            ))}
          </select>
        </div>

        {/* Priority */}
        <div>
          <label className="block text-[11px] font-medium mb-1" style={{ color: "var(--th-text-secondary)" }}>
            {t({ ko: "우선순위", en: "Priority" })}
          </label>
          <div className="flex items-center gap-1">
            {[1, 2, 3, 4, 5].map((p) => (
              <button
                key={p}
                onClick={() => setPriority(p)}
                className="p-0.5 transition-transform hover:scale-110"
              >
                <Star
                  width={18}
                  height={18}
                  fill={p <= priority ? "#f59e0b" : "transparent"}
                  stroke={p <= priority ? "#f59e0b" : "var(--th-text-muted)"}
                />
              </button>
            ))}
            <span className={`ml-2 w-2 h-2 rounded-full ${priorityColor(priority)}`} />
          </div>
        </div>

        {/* Agent */}
        <div>
          <label className="block text-[11px] font-medium mb-1" style={{ color: "var(--th-text-secondary)" }}>
            {t({ ko: "담당 에이전트", en: "Assign Agent" })}
          </label>
          <select
            value={assignAgentId}
            onChange={(e) => setAssignAgentId(e.target.value)}
            className="w-full rounded-md px-3 py-2 text-sm bg-transparent outline-none"
            style={{ border: "1px solid var(--th-border)", color: "var(--th-text-primary)" }}
          >
            <option value="">{t({ ko: "-- 자동 배정 --", en: "-- Auto assign --" })}</option>
            {filteredAgents.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name} ({a.role})
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Footer */}
      <div
        className="flex items-center justify-end gap-2 px-4 py-3"
        style={{ borderTop: "1px solid var(--th-border)" }}
      >
        <button
          onClick={onCancel}
          className="px-3 py-1.5 text-xs rounded-md transition-colors"
          style={{ color: "var(--th-text-secondary)", border: "1px solid var(--th-border)" }}
        >
          {t({ ko: "취소", en: "Cancel" })}
        </button>
        <button
          onClick={handleSubmit}
          disabled={!title.trim() || busy}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-md bg-blue-600 text-white transition-colors hover:bg-blue-700 disabled:opacity-40"
        >
          <Send width={12} height={12} />
          {t({ ko: "지시하기", en: "Send Directive" })}
        </button>
      </div>
    </div>
  );
}
