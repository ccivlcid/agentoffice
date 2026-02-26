import { useCallback, useMemo } from 'react';
import type { Project } from '../../types';
import type { ProjectDetailResponse, ProjectTaskHistoryItem } from '../../api';
import { useI18n } from '../../i18n';
import { fmtTime } from './projectManagerHelpers';

interface ProjectManagerDetailProps {
  selectedProject: Project | null;
  isCreating: boolean;
  loadingDetail: boolean;
  detail: ProjectDetailResponse | null;
  onOpenTaskDetail: (taskId: string) => void;
}

export default function ProjectManagerDetail({
  selectedProject,
  isCreating,
  loadingDetail,
  detail,
  onOpenTaskDetail,
}: ProjectManagerDetailProps) {
  const { t } = useI18n();

  const groupedTaskCards = useMemo(() => {
    if (!detail) return [];
    const rows = [...detail.tasks].sort((a, b) => (b.created_at || 0) - (a.created_at || 0));
    const byId = new Map<string, ProjectTaskHistoryItem>(rows.map((row) => [row.id, row]));
    const groups = new Map<
      string,
      { root: ProjectTaskHistoryItem; children: ProjectTaskHistoryItem[]; latestAt: number }
    >();

    for (const row of rows) {
      const parentId = typeof row.source_task_id === 'string' && row.source_task_id.trim()
        ? row.source_task_id.trim()
        : null;
      const root = parentId ? (byId.get(parentId) ?? row) : row;
      const rootId = root.id;
      const existing = groups.get(rootId);
      const group = existing ?? { root, children: [], latestAt: root.created_at || 0 };

      if (row.id === rootId) {
        group.root = row;
      } else {
        group.children.push(row);
      }
      group.latestAt = Math.max(group.latestAt, row.created_at || 0);
      groups.set(rootId, group);
    }

    return [...groups.values()]
      .map((group) => ({
        ...group,
        children: [...group.children].sort((a, b) => (b.created_at || 0) - (a.created_at || 0)),
      }))
      .sort((a, b) => b.latestAt - a.latestAt);
  }, [detail]);

  const sortedReports = useMemo(() => {
    if (!detail) return [];
    return [...detail.reports].sort((a, b) => (b.completed_at || b.created_at || 0) - (a.completed_at || a.created_at || 0));
  }, [detail]);

  const sortedDecisionEvents = useMemo(() => {
    if (!detail) return [];
    return [...(detail.decision_events ?? [])].sort((a, b) => (b.created_at || 0) - (a.created_at || 0));
  }, [detail]);

  const getDecisionEventLabel = useCallback((eventType: string) => {
    if (eventType === 'planning_summary') return t({ ko: '기획팀장 분류', en: 'Planning Classification' });
    if (eventType === 'representative_pick') return t({ ko: '대표 항목 선택', en: 'Representative Pick' });
    if (eventType === 'followup_request') return t({ ko: '추가 요청', en: 'Follow-up Request' });
    if (eventType === 'start_review_meeting') return t({ ko: '팀장 회의 시작', en: 'Team-Lead Meeting Start' });
    return eventType;
  }, [t]);

  return (
    <div className="min-w-0 space-y-4">
      <div className="min-w-0 rounded-xl border border-slate-700 bg-slate-800/40 p-4">
        <div className="flex items-center justify-between">
          <h4 className="text-sm font-semibold text-white">
            {t({ ko: '프로젝트 정보', en: 'Project Info' })}
          </h4>
          {selectedProject?.github_repo && (
            <a
              href={`https://github.com/${selectedProject.github_repo}`}
              target="_blank"
              rel="noopener noreferrer"
              title={selectedProject.github_repo}
              className="flex items-center gap-1 rounded-md border border-slate-600 px-2 py-0.5 text-[11px] text-slate-300 transition hover:border-blue-500 hover:text-white"
            >
              <svg className="h-3.5 w-3.5" viewBox="0 0 16 16" fill="currentColor">
                <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z" />
              </svg>
              {selectedProject.github_repo}
            </a>
          )}
        </div>
        {loadingDetail ? (
          <p className="mt-2 text-xs text-slate-400">{t({ ko: '불러오는 중...', en: 'Loading...' })}</p>
        ) : isCreating ? (
          <p className="mt-2 text-xs text-slate-500">{t({ ko: '신규 프로젝트를 입력 중입니다', en: 'Creating a new project' })}</p>
        ) : !selectedProject ? (
          <p className="mt-2 text-xs text-slate-500">{t({ ko: '프로젝트를 선택하세요', en: 'Select a project' })}</p>
        ) : (
          <div className="mt-2 space-y-2 text-xs">
            <p className="text-slate-200"><span className="text-slate-500">ID:</span> {selectedProject.id}</p>
            <p className="break-all text-slate-200"><span className="text-slate-500">Path:</span> {selectedProject.project_path}</p>
            <p className="break-all text-slate-200"><span className="text-slate-500">Goal:</span> {selectedProject.core_goal}</p>
          </div>
        )}
      </div>

      <div className="min-w-0 rounded-xl border border-slate-700 bg-slate-800/40 p-4">
        <h4 className="text-sm font-semibold text-white">
          {t({ ko: '작업 이력', en: 'Task History' })}
        </h4>
        {!selectedProject ? (
          <p className="mt-2 text-xs text-slate-500">-</p>
        ) : groupedTaskCards.length === 0 ? (
          <p className="mt-2 text-xs text-slate-500">{t({ ko: '연결된 작업이 없습니다', en: 'No mapped tasks' })}</p>
        ) : (
          <div className="mt-2 max-h-56 overflow-x-hidden overflow-y-auto space-y-2 pr-1">
            {groupedTaskCards.map((group) => (
              <button
                key={group.root.id}
                type="button"
                onClick={() => void onOpenTaskDetail(group.root.id)}
                className="w-full min-w-0 overflow-hidden rounded-lg border border-slate-700/70 bg-slate-900/60 px-3 py-2 text-left transition hover:border-blue-500/70 hover:bg-slate-900"
              >
                <p className="whitespace-pre-wrap break-all text-xs font-semibold text-slate-100">{group.root.title}</p>
                <p className="mt-1 break-all text-[11px] text-slate-400">
                  {group.root.status} · {group.root.task_type} · {fmtTime(group.root.created_at)}
                </p>
                <p className="mt-1 break-all text-[11px] text-slate-500">
                  {t({ ko: '담당', en: 'Owner' })}: {group.root.assigned_agent_name_ko || group.root.assigned_agent_name || '-'}
                </p>
                <p className="mt-1 text-[11px] text-blue-300">
                  {t({ ko: '하위 작업', en: 'Sub tasks' })}: {group.children.length}
                </p>
                {group.children.length > 0 && (
                  <div className="mt-1 space-y-1">
                    {group.children.slice(0, 3).map((child) => (
                      <p key={child.id} className="whitespace-pre-wrap break-all text-[11px] text-slate-500">
                        - {child.title}
                      </p>
                    ))}
                    {group.children.length > 3 && (
                      <p className="text-[11px] text-slate-500">+{group.children.length - 3}</p>
                    )}
                  </div>
                )}
                <p className="mt-2 text-right text-[11px] text-emerald-300">
                  {t({ ko: '카드 클릭으로 상세 보기', en: 'Click card for details' })}
                </p>
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="min-w-0 rounded-xl border border-slate-700 bg-slate-800/40 p-4">
        <h4 className="text-sm font-semibold text-white">
          {t({ ko: '보고서 이력(프로젝트 매핑)', en: 'Mapped Reports' })}
        </h4>
        {!selectedProject ? (
          <p className="mt-2 text-xs text-slate-500">-</p>
        ) : sortedReports.length === 0 ? (
          <p className="mt-2 text-xs text-slate-500">{t({ ko: '연결된 보고서가 없습니다', en: 'No mapped reports' })}</p>
        ) : (
          <div className="mt-2 max-h-56 overflow-x-hidden overflow-y-auto space-y-2 pr-1">
            {sortedReports.map((row) => (
              <div key={row.id} className="flex min-w-0 items-center justify-between gap-2 rounded-lg border border-slate-700/70 bg-slate-900/60 px-3 py-2">
                <div className="min-w-0">
                  <p className="whitespace-pre-wrap break-all text-xs font-medium text-slate-100">{row.title}</p>
                  <p className="text-[11px] text-slate-400">{fmtTime(row.completed_at || row.created_at)}</p>
                </div>
                <button
                  type="button"
                  onClick={() => void onOpenTaskDetail(row.id)}
                  className="shrink-0 rounded-md bg-emerald-700 px-2 py-1 text-[11px] text-white hover:bg-emerald-600"
                >
                  {t({ ko: '열람', en: 'Open' })}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="min-w-0 rounded-xl border border-slate-700 bg-slate-800/40 p-4">
        <h4 className="text-sm font-semibold text-white">
          {t({ ko: '대표 선택사항', en: 'Representative Decisions' })}
        </h4>
        {!selectedProject ? (
          <p className="mt-2 text-xs text-slate-500">-</p>
        ) : sortedDecisionEvents.length === 0 ? (
          <p className="mt-2 text-xs text-slate-500">
            {t({ ko: '기록된 대표 의사결정이 없습니다', en: 'No representative decision records' })}
          </p>
        ) : (
          <div className="mt-2 max-h-56 overflow-x-hidden overflow-y-auto space-y-2 pr-1">
            {sortedDecisionEvents.map((event) => {
              let selectedLabels: string[] = [];
              if (event.selected_options_json) {
                try {
                  const parsed = JSON.parse(event.selected_options_json) as Array<{ label?: unknown }>;
                  selectedLabels = Array.isArray(parsed)
                    ? parsed.map((row) => (typeof row?.label === 'string' ? row.label.trim() : '')).filter((label) => label.length > 0)
                    : [];
                } catch {
                  selectedLabels = [];
                }
              }
              return (
                <div key={`${event.id}-${event.created_at}`} className="rounded-lg border border-slate-700/70 bg-slate-900/60 px-3 py-2">
                  <div className="flex items-center justify-between gap-2">
                    <p className="min-w-0 truncate text-xs font-semibold text-slate-100">{getDecisionEventLabel(event.event_type)}</p>
                    <p className="text-[11px] text-slate-400">{fmtTime(event.created_at)}</p>
                  </div>
                  <p className="mt-1 whitespace-pre-wrap break-all text-[11px] text-slate-300">{event.summary}</p>
                  {selectedLabels.length > 0 && (
                    <p className="mt-1 whitespace-pre-wrap break-all text-[11px] text-blue-300">
                      {t({ ko: '선택 내용', en: 'Selected Items' })}: {selectedLabels.join(' / ')}
                    </p>
                  )}
                  {event.note && event.note.trim().length > 0 && (
                    <p className="mt-1 whitespace-pre-wrap break-all text-[11px] text-emerald-300">
                      {t({ ko: '추가 요청사항', en: 'Additional Request' })}: {event.note}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
