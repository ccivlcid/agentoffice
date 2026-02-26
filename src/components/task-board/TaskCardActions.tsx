import type { Task } from "../../types";
import type { TFunction } from "./taskBoardHelpers";
import { Play, Pause, Square, RotateCcw, Monitor, FileText, EyeOff, Eye, Trash2 } from "lucide-react";

export interface TaskCardActionsProps {
  task: Task;
  t: TFunction;
  isHiddenTask?: boolean;
  canRun: boolean;
  canStop: boolean;
  canPause: boolean;
  canResume: boolean;
  canDelete: boolean;
  canHideTask: boolean;
  onRunClick: () => void;
  onStopTask: (id: string) => void;
  onPauseTask?: (id: string) => void;
  onResumeTask?: (id: string) => void;
  onOpenTerminal?: (taskId: string) => void;
  onOpenMeetingMinutes?: (taskId: string) => void;
  onShowDiff: () => void;
  onHideTask?: (id: string) => void;
  onUnhideTask?: (id: string) => void;
  onDeleteTask: (id: string) => void;
}

const BTN = "flex items-center justify-center rounded-lg px-2 py-1.5 text-xs font-medium transition";

export function TaskCardActions({
  task,
  t,
  isHiddenTask,
  canRun,
  canStop,
  canPause,
  canResume,
  canDelete,
  canHideTask,
  onRunClick,
  onStopTask,
  onPauseTask,
  onResumeTask,
  onOpenTerminal,
  onOpenMeetingMinutes,
  onShowDiff,
  onHideTask,
  onUnhideTask,
  onDeleteTask,
}: TaskCardActionsProps) {
  const s = task.status;
  const showTerminal = (s === "in_progress" || s === "review" || s === "done" || s === "pending") && onOpenTerminal;
  const showMinutes =
    (s === "planned" || s === "collaborating" || s === "in_progress" || s === "review" || s === "done" || s === "pending") &&
    onOpenMeetingMinutes;

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {canRun && (
        <button onClick={onRunClick} title={t({ ko: "작업 실행", en: "Run task" })} className={`${BTN} flex-1 gap-1 bg-green-700 text-white hover:bg-green-600`}>
          <Play width={14} height={14} /> {t({ ko: "실행", en: "Run" })}
        </button>
      )}
      {canPause && (
        <button onClick={() => onPauseTask!(task.id)} title={t({ ko: "작업 일시중지", en: "Pause task" })} className={`${BTN} flex-1 gap-1 bg-orange-700 text-white hover:bg-orange-600`}>
          <Pause width={14} height={14} /> {t({ ko: "일시중지", en: "Pause" })}
        </button>
      )}
      {canStop && (
        <button
          onClick={() => {
            if (
              confirm(
                t({
                  ko: `"${task.title}" 작업을 중지할까요?\n\n경고: Stop 처리 시 해당 프로젝트 변경분은 롤백됩니다.`,
                  en: `Stop "${task.title}"?\n\nWarning: stopping will roll back project changes.`,
                }),
              )
            )
              onStopTask(task.id);
          }}
          title={t({ ko: "작업 중지", en: "Cancel task" })}
          className={`${BTN} gap-1 bg-red-800 text-white hover:bg-red-700`}
        >
          <Square width={14} height={14} /> {t({ ko: "중지", en: "Cancel" })}
        </button>
      )}
      {canResume && (
        <button onClick={() => onResumeTask!(task.id)} title={t({ ko: "작업 재개", en: "Resume task" })} className={`${BTN} flex-1 gap-1 bg-blue-700 text-white hover:bg-blue-600`}>
          <RotateCcw width={14} height={14} /> {t({ ko: "재개", en: "Resume" })}
        </button>
      )}
      {showTerminal && (
        <button onClick={() => onOpenTerminal!(task.id)} title={t({ ko: "터미널 출력 보기", en: "View terminal output" })} className={`${BTN} bg-slate-800/70 text-slate-200 hover:bg-slate-700 hover:text-white`}>
          <Monitor width={14} height={14} />
        </button>
      )}
      {showMinutes && (
        <button onClick={() => onOpenMeetingMinutes!(task.id)} title={t({ ko: "회의록 보기", en: "View meeting minutes" })} className={`${BTN} bg-cyan-800/70 text-cyan-200 hover:bg-cyan-700 hover:text-white`}>
          <FileText width={14} height={14} />
        </button>
      )}
      {s === "review" && (
        <button onClick={onShowDiff} title={t({ ko: "변경사항 보기 (Git diff)", en: "View changes (Git diff)" })} className={`${BTN} gap-1 bg-purple-800 text-purple-200 hover:bg-purple-700`}>
          {t({ ko: "Diff", en: "Diff" })}
        </button>
      )}
      {canHideTask && !isHiddenTask && onHideTask && (
        <button onClick={() => onHideTask(task.id)} title={t({ ko: "완료/보류/취소 작업 숨기기", en: "Hide done/pending/cancelled task" })} className={`${BTN} gap-1 bg-slate-800/70 text-slate-200 hover:bg-slate-700 hover:text-white`}>
          <EyeOff width={14} height={14} /> {t({ ko: "숨김", en: "Hide" })}
        </button>
      )}
      {canHideTask && !!isHiddenTask && onUnhideTask && (
        <button onClick={() => onUnhideTask(task.id)} title={t({ ko: "숨긴 작업 복원", en: "Restore hidden task" })} className={`${BTN} gap-1 bg-blue-800 text-blue-200 hover:bg-blue-700 hover:text-white`}>
          <Eye width={14} height={14} /> {t({ ko: "복원", en: "Restore" })}
        </button>
      )}
      {canDelete && (
        <button
          onClick={() => {
            if (confirm(t({ ko: `"${task.title}" 업무를 삭제할까요?`, en: `Delete "${task.title}"?` }))) onDeleteTask(task.id);
          }}
          title={t({ ko: "작업 삭제", en: "Delete task" })}
          className={`${BTN} bg-red-900/60 text-red-400 hover:bg-red-800 hover:text-red-300`}
        >
          <Trash2 width={14} height={14} />
        </button>
      )}
    </div>
  );
}
