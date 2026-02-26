import { useMemo, useState, useEffect } from 'react';
import type { Agent } from '../types';
import type { TaskReportDetail } from '../api';
import { archiveTaskReport, getTaskReportDetail } from '../api';
import type { UiLanguage } from '../i18n';
import { pickLang } from '../i18n';
import AgentAvatar from './AgentAvatar';
import { fmtTime, elapsed, projectNameFromPath } from './TaskReportPopupHelpers';
import TaskReportPlanningSummary from './TaskReportPlanningSummary';
import TaskReportTeamView from './TaskReportTeamView';

interface TaskReportPopupProps {
  report: TaskReportDetail;
  agents: Agent[];
  uiLanguage: UiLanguage;
  onClose: () => void;
}

export default function TaskReportPopup({ report, agents, uiLanguage, onClose }: TaskReportPopupProps) {
  const t = (text: { ko: string; en: string; ja?: string; zh?: string }) => pickLang(uiLanguage, text);

  const [currentReport, setCurrentReport] = useState<TaskReportDetail>(report);
  const [refreshingArchive, setRefreshingArchive] = useState(false);
  const [activeTab, setActiveTab] = useState<string>('planning');
  const [expandedDocs, setExpandedDocs] = useState<Record<string, boolean>>({});
  const [documentPages, setDocumentPages] = useState<Record<string, number>>({});

  useEffect(() => {
    setCurrentReport(report);
  }, [report]);

  const rootTaskId = currentReport.project?.root_task_id || currentReport.task.id;
  const teamReports = currentReport.team_reports ?? [];
  const projectName = currentReport.project?.project_name || projectNameFromPath(currentReport.task.project_path);
  const projectPath = currentReport.project?.project_path || currentReport.task.project_path;
  const planningSummary = currentReport.planning_summary;

  const refreshArchive = async () => {
    if (!rootTaskId || refreshingArchive) return;
    setRefreshingArchive(true);
    try {
      await archiveTaskReport(rootTaskId);
      const refreshed = await getTaskReportDetail(rootTaskId);
      setCurrentReport(refreshed);
    } catch (err) {
      console.error('Failed to refresh planning archive:', err);
    } finally {
      setRefreshingArchive(false);
    }
  };

  useEffect(() => {
    setActiveTab('planning');
    setExpandedDocs({});
    setDocumentPages({});
  }, [currentReport.task.id, currentReport.requested_task_id, teamReports.length]);

  const taskAgent = agents.find((a) => a.id === currentReport.task.assigned_agent_id);
  const taskAgentName = uiLanguage === 'ko'
    ? (currentReport.task.agent_name_ko || currentReport.task.agent_name)
    : currentReport.task.agent_name;
  const taskDeptName = uiLanguage === 'ko'
    ? (currentReport.task.dept_name_ko || currentReport.task.dept_name)
    : currentReport.task.dept_name;

  const selectedTeam = useMemo(() => {
    if (activeTab === 'planning') return null;
    return teamReports.find((team) => team.id === activeTab || team.task_id === activeTab) ?? null;
  }, [activeTab, teamReports]);

  const toggleDoc = (docId: string) => {
    setExpandedDocs((prev) => {
      const current = prev[docId] !== false;
      return { ...prev, [docId]: !current };
    });
  };

  const sharedDocProps = { expandedDocs, documentPages, onToggleDoc: toggleDoc, setDocumentPages, t };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={onClose}>
      <div
        className="relative mx-4 w-full max-w-4xl rounded-2xl border border-emerald-500/30 bg-slate-900 shadow-2xl shadow-emerald-500/10"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-slate-700/50 px-6 py-4">
          <div className="min-w-0">
            <div className="mb-1 flex items-center gap-2">
              <span className="text-xl">&#x1F4CB;</span>
              <h2 className="truncate text-lg font-bold text-white">
                {t({ ko: '작업 완료 보고서', en: 'Task Completion Report' })}
              </h2>
              <span className="rounded bg-emerald-500/20 px-2 py-0.5 text-xs text-emerald-300">
                {projectName}
              </span>
            </div>
            <p className="truncate text-xs text-slate-400">
              {projectPath || '-'}
            </p>
          </div>
          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-800 hover:text-white"
          >
            &#x2715;
          </button>
        </div>

        <div className="border-b border-slate-700/40 px-6 py-3">
          <div className="flex items-start gap-3">
            <AgentAvatar agent={taskAgent} agents={agents} size={40} rounded="xl" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-white">{currentReport.task.title}</p>
              <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-400">
                <span className="rounded bg-slate-700/70 px-1.5 py-0.5">{taskDeptName}</span>
                <span>{taskAgentName} ({currentReport.task.agent_role})</span>
                <span>{t({ ko: '완료', en: 'Completed' })}: {fmtTime(currentReport.task.completed_at)}</span>
                <span className="rounded bg-emerald-500/15 px-1.5 py-0.5 text-emerald-400">
                  {elapsed(currentReport.task.created_at, currentReport.task.completed_at)}
                </span>
              </div>
            </div>
          </div>
        </div>

        <div className="border-b border-slate-700/40 px-6 py-2.5">
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => setActiveTab('planning')}
              className={`rounded-lg px-3 py-1.5 text-xs ${
                activeTab === 'planning'
                  ? 'bg-emerald-600 text-white'
                  : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
              }`}
            >
              {t({ ko: '기획팀장 취합본', en: 'Planning Summary' })}
            </button>
            {teamReports.map((team) => {
              const label = uiLanguage === 'ko'
                ? (team.department_name_ko || team.department_name || team.department_id || '팀')
                : (team.department_name || team.department_id || 'Team');
              return (
                <button
                  key={team.id}
                  onClick={() => setActiveTab(team.id)}
                  className={`rounded-lg px-3 py-1.5 text-xs ${
                    activeTab === team.id
                      ? 'bg-blue-600 text-white'
                      : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                  }`}
                >
                  {label}
                </button>
              );
            })}
          </div>
        </div>

        <div className="max-h-[68vh] overflow-y-auto px-6 py-4">
          {activeTab === 'planning' ? (
            <TaskReportPlanningSummary
              planningSummary={planningSummary}
              refreshingArchive={refreshingArchive}
              onRefresh={refreshArchive}
              {...sharedDocProps}
            />
          ) : selectedTeam ? (
            <TaskReportTeamView team={selectedTeam} uiLanguage={uiLanguage} {...sharedDocProps} />
          ) : (
            <p className="text-sm text-slate-500">
              {t({ ko: '표시할 보고서가 없습니다', en: 'No report to display' })}
            </p>
          )}
        </div>

        <div className="border-t border-slate-700/50 px-6 py-3">
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-500">
              {t({ ko: `팀 보고서 ${teamReports.length}개`, en: `${teamReports.length} team reports`, ja: `チームレポート ${teamReports.length}件`, zh: `${teamReports.length} 个团队报告` })}
            </span>
            <button
              onClick={onClose}
              className="rounded-lg bg-emerald-600 px-4 py-1.5 text-sm font-medium text-white transition hover:bg-emerald-500"
            >
              {t({ ko: '확인', en: 'OK' })}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
