import type { RefObject } from 'react';
import type { TaskType, Department, Agent, Project } from '../../types';
import AgentSelect from '../AgentSelect';
import { Icon } from '../ui/Icon';
import { Star } from 'lucide-react';
import {
  useI18n,
  taskTypeLabel,
  priorityColor,
  priorityLabel,
  TASK_TYPE_OPTIONS,
  type FormFeedback,
  type MissingPathPrompt,
} from './taskBoardHelpers';

interface ProjectPickerProps {
  projectQuery: string;
  projectDropdownOpen: boolean;
  projectsLoading: boolean;
  filteredProjects: Project[];
  projectActiveIndex: number;
  selectedProject: Project | null;
  createNewProjectMode: boolean;
  newProjectPath: string;
  pathSuggestionsOpen: boolean;
  pathSuggestionsLoading: boolean;
  pathSuggestions: string[];
  missingPathPrompt: MissingPathPrompt | null;
  pathApiUnsupported: boolean;
  nativePathPicking: boolean;
  nativePickerUnsupported: boolean;
  pickerRef: RefObject<HTMLDivElement | null>;
  t: ReturnType<typeof useI18n>['t'];
  locale: string;
  onQueryChange: (v: string) => void;
  onFocusInput: () => void;
  onToggleDropdown: () => void;
  onKeyDown: (e: React.KeyboardEvent<HTMLInputElement>) => void;
  onSelectNull: () => void;
  onSelectProject: (p: Project) => void;
  onSetActiveIndex: (i: number) => void;
  onStartNewProject: () => void;
  onPathChange: (v: string) => void;
  onToggleSuggestions: () => void;
  onOpenManualPicker: () => void;
  onNativePick: () => void;
  onPickSuggestion: (path: string) => void;
  projects: Project[];
}

export function ProjectPickerSection({
  projectQuery, projectDropdownOpen, projectsLoading, filteredProjects,
  projectActiveIndex, selectedProject, createNewProjectMode, newProjectPath,
  pathSuggestionsOpen, pathSuggestionsLoading, pathSuggestions, missingPathPrompt,
  pathApiUnsupported, nativePathPicking, nativePickerUnsupported,
  pickerRef, t, locale, onQueryChange, onFocusInput, onToggleDropdown, onKeyDown,
  onSelectNull, onSelectProject, onSetActiveIndex, onStartNewProject,
  onPathChange, onToggleSuggestions, onOpenManualPicker, onNativePick, onPickSuggestion, projects,
}: ProjectPickerProps) {
  return (
    <div>
      <label className="mb-1 block text-sm font-medium text-slate-300">
        {t({ ko: '프로젝트명', en: 'Project Name' })}
      </label>
      <div className="relative" ref={pickerRef}>
        <div className="flex items-center gap-2">
          <input type="text" value={projectQuery} onChange={(e) => onQueryChange(e.target.value)}
            onFocus={onFocusInput} onKeyDown={onKeyDown}
            placeholder={t({ ko: '프로젝트 이름 또는 경로 입력', en: 'Type project name or path' })}
            className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white placeholder-slate-500 outline-none transition focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
          />
          <button type="button" onClick={onToggleDropdown}
            className="rounded-lg border border-slate-700 bg-slate-800 px-2.5 py-2 text-xs text-slate-300 transition hover:bg-slate-700 hover:text-white"
            title={t({ ko: '프로젝트 목록 토글', en: 'Toggle project list' })}>
            {projectDropdownOpen ? '▲' : '▼'}
          </button>
        </div>
        {projectDropdownOpen && (
          <div className="absolute z-20 mt-1 max-h-52 w-full overflow-y-auto rounded-lg border border-slate-700 bg-slate-900 shadow-xl">
            <button type="button" onMouseDown={(e) => { e.preventDefault(); onSelectNull(); }}
              className="w-full border-b border-slate-800 px-3 py-2 text-left text-sm text-slate-300 transition hover:bg-slate-800">
              {t({ ko: '-- 프로젝트 미지정 --', en: '-- No project --' })}
            </button>
            {projectsLoading ? (
              <div className="px-3 py-2 text-sm text-slate-400">{t({ ko: '프로젝트 불러오는 중...', en: 'Loading projects...' })}</div>
            ) : filteredProjects.length === 0 ? (
              <div className="flex items-center justify-between gap-2 px-3 py-2 text-sm text-slate-300">
                <p className="pr-2">{t({ ko: '신규 프로젝트로 생성할까요?', en: 'Create as a new project?' })}</p>
                <button type="button" onMouseDown={(e) => { e.preventDefault(); onStartNewProject(); }}
                  className="ml-auto shrink-0 rounded-md border border-emerald-500 bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-emerald-500">
                  {t({ ko: '예', en: 'Yes' })}
                </button>
              </div>
            ) : (
              filteredProjects.map((project, idx) => (
                <button key={project.id} type="button"
                  onMouseDown={(e) => { e.preventDefault(); onSelectProject(project); }}
                  onMouseEnter={() => onSetActiveIndex(idx)}
                  className={`w-full px-3 py-2 text-left transition hover:bg-slate-800 ${
                    projectActiveIndex >= 0 && filteredProjects[projectActiveIndex]?.id === project.id
                      ? 'bg-slate-700/90' : selectedProject?.id === project.id ? 'bg-slate-800/80' : ''
                  }`}>
                  <div className="truncate text-sm text-slate-100">{project.name}</div>
                  <div className="truncate text-[11px] text-slate-400">{project.project_path}</div>
                </button>
              ))
            )}
          </div>
        )}
      </div>
      {selectedProject && <p className="mt-1 break-all text-xs text-slate-400">{selectedProject.project_path}</p>}
      {createNewProjectMode && !selectedProject && (
        <div className="mt-2 space-y-2">
          <label className="block text-xs text-slate-400">{t({ ko: '신규 프로젝트 경로', en: 'New project path' })}</label>
          <input type="text" value={newProjectPath} onChange={(e) => onPathChange(e.target.value)}
            placeholder="/absolute/path/to/project"
            className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white placeholder-slate-500 outline-none transition focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
          />
          <div className="flex justify-end gap-2">
            <button type="button" disabled={pathApiUnsupported} onClick={onOpenManualPicker}
              className="rounded-md border border-slate-600 px-2.5 py-1 text-xs font-semibold text-slate-200 transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-40">
              {t({ ko: '앱 내 폴더 탐색', en: 'In-App Folder Browser' })}
            </button>
            <button type="button" disabled={pathApiUnsupported} onClick={onToggleSuggestions}
              className="rounded-md border border-slate-600 px-2.5 py-1 text-xs font-semibold text-slate-200 transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-40">
              {pathSuggestionsOpen
                ? t({ ko: '자동 경로찾기 닫기', en: 'Close Auto Finder' })
                : t({ ko: '자동 경로찾기', en: 'Auto Path Finder' })}
            </button>
            <button type="button" disabled={nativePathPicking || nativePickerUnsupported} onClick={onNativePick}
              className="rounded-md border border-slate-600 px-2.5 py-1 text-xs font-semibold text-slate-200 transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-40">
              {nativePathPicking
                ? t({ ko: '수동 경로찾기 여는 중...', en: 'Opening Manual Picker...' })
                : nativePickerUnsupported
                  ? t({ ko: '수동 경로찾기(사용불가)', en: 'Manual Path Finder (Unavailable)' })
                  : t({ ko: '수동 경로찾기', en: 'Manual Path Finder' })}
            </button>
          </div>
          {pathSuggestionsOpen && (
            <div className="max-h-40 overflow-y-auto rounded-lg border border-slate-700 bg-slate-800/70">
              {pathSuggestionsLoading ? (
                <p className="px-3 py-2 text-xs text-slate-400">{t({ ko: '경로 후보를 불러오는 중...', en: 'Loading path suggestions...' })}</p>
              ) : pathSuggestions.length === 0 ? (
                <p className="px-3 py-2 text-xs text-slate-400">{t({ ko: '추천 경로가 없습니다. 직접 입력해주세요.', en: 'No suggested path. Enter one manually.' })}</p>
              ) : (
                pathSuggestions.map((candidate) => (
                  <button key={candidate} type="button" onClick={() => onPickSuggestion(candidate)}
                    className="w-full px-3 py-2 text-left text-xs text-slate-200 transition hover:bg-slate-700/70">
                    {candidate}
                  </button>
                ))
              )}
            </div>
          )}
          {missingPathPrompt && (
            <p className="text-xs text-amber-300">{t({ ko: '해당 경로가 아직 존재하지 않습니다. 생성 확인 후 진행됩니다.', en: 'This path does not exist yet. Creation confirmation will be requested.' })}</p>
          )}
          <p className="text-xs text-slate-500">{t({ ko: '설명 항목 내용이 신규 프로젝트의 핵심 목표(core_goal)로 저장됩니다.', en: 'Description will be saved as the new project core goal.' })}</p>
        </div>
      )}
      {!projectsLoading && projects.length === 0 && (
        <p className="mt-1 text-xs text-slate-500">{t({ ko: '등록된 프로젝트가 없습니다. 프로젝트 관리에서 먼저 생성해주세요.', en: 'No registered project. Create one first in Project Manager.' })}</p>
      )}
    </div>
  );
}

interface CreateModalFormBodyProps {
  title: string; description: string; departmentId: string; taskType: TaskType;
  priority: number; assignAgentId: string; departments: Department[]; agents: Agent[];
  filteredAgents: Agent[]; createNewProjectMode: boolean; formFeedback: FormFeedback | null;
  submitBusy: boolean; locale: string;
  projectPickerProps: Omit<ProjectPickerProps, 't' | 'locale'>;
  onTitleChange: (v: string) => void; onDescriptionChange: (v: string) => void;
  onDepartmentChange: (v: string) => void; onTaskTypeChange: (v: TaskType) => void;
  onPriorityChange: (v: number) => void; onAssignAgentChange: (v: string) => void;
  onClose: () => void; onSubmit: () => void; t: ReturnType<typeof useI18n>['t'];
}

export function CreateModalFormBody({
  title, description, departmentId, taskType, priority, assignAgentId,
  departments, agents, filteredAgents, createNewProjectMode, formFeedback,
  submitBusy, locale, projectPickerProps, onTitleChange, onDescriptionChange,
  onDepartmentChange, onTaskTypeChange, onPriorityChange, onAssignAgentChange,
  onClose, onSubmit, t,
}: CreateModalFormBodyProps) {
  const prioritySection = (
    <div>
      <label className="mb-2 block text-sm font-medium text-slate-300">
        {t({ ko: '우선순위', en: 'Priority' })}: <span className={`inline-block w-2 h-2 rounded-full shrink-0 align-middle ${priorityColor(priority)}`} aria-hidden /> {priorityLabel(priority, t)} ({priority}/5)
      </label>
      <div className="flex gap-2">
        {[1, 2, 3, 4, 5].map((star) => (
          <button key={star} type="button" onClick={() => onPriorityChange(star)}
            className={`flex-1 rounded-lg py-2 text-lg transition flex items-center justify-center ${star <= priority ? 'bg-amber-600 text-white shadow-md' : 'bg-slate-800 text-slate-500 hover:bg-slate-700'}`}>
            <Icon icon={Star} size="sm" aria-hidden />
          </button>
        ))}
      </div>
    </div>
  );
  const assigneeSection = (
    <div>
      <label className="mb-1 block text-sm font-medium text-slate-300">
        {t({ ko: '담당 에이전트', en: 'Assignee' })}
      </label>
      <AgentSelect agents={filteredAgents} departments={departments} value={assignAgentId}
        onChange={onAssignAgentChange}
        placeholder={t({ ko: '-- 미배정 --', en: '-- Unassigned --' })} size="md" />
      {departmentId && filteredAgents.length === 0 && (
        <p className="mt-1 text-xs text-slate-500">{t({ ko: '해당 부서에 에이전트가 없습니다.', en: 'No agents are available in this department.' })}</p>
      )}
    </div>
  );
  return (
    <form onSubmit={(e) => { e.preventDefault(); onSubmit(); }} className="flex min-h-0 flex-1 flex-col">
      <div className={`min-h-0 flex-1 overflow-y-auto px-6 py-4 lg:overflow-visible ${createNewProjectMode ? 'lg:grid lg:grid-cols-2 lg:gap-5' : ''}`}>
        <div className="min-w-0 space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-300">{t({ ko: '제목', en: 'Title' })} <span className="text-red-400">*</span></label>
            <input type="text" value={title} onChange={(e) => onTitleChange(e.target.value)}
              placeholder={t({ ko: '업무 제목을 입력하세요', en: 'Enter a task title' })}
              required className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white placeholder-slate-500 outline-none transition focus:border-blue-500 focus:ring-1 focus:ring-blue-500" />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-300">{t({ ko: '설명', en: 'Description' })}</label>
            <textarea value={description} onChange={(e) => onDescriptionChange(e.target.value)}
              placeholder={t({ ko: '업무에 대한 상세 설명을 입력하세요', en: 'Enter a detailed description' })}
              rows={3} className="w-full resize-none rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white placeholder-slate-500 outline-none transition focus:border-blue-500 focus:ring-1 focus:ring-blue-500" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-300">{t({ ko: '부서', en: 'Department' })}</label>
              <select value={departmentId} onChange={(e) => onDepartmentChange(e.target.value)}
                className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white outline-none transition focus:border-blue-500 focus:ring-1 focus:ring-blue-500">
                <option value="">{t({ ko: '-- 전체 --', en: '-- All --' })}</option>
                {departments.map((d) => <option key={d.id} value={d.id}>{d.icon} {locale === 'ko' ? d.name_ko : d.name}</option>)}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-300">{t({ ko: '업무 유형', en: 'Task Type' })}</label>
              <select value={taskType} onChange={(e) => onTaskTypeChange(e.target.value as TaskType)}
                className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white outline-none transition focus:border-blue-500 focus:ring-1 focus:ring-blue-500">
                {TASK_TYPE_OPTIONS.map((opt) => <option key={opt.value} value={opt.value}>{taskTypeLabel(opt.value, t)}</option>)}
              </select>
            </div>
          </div>
          <ProjectPickerSection {...projectPickerProps} t={t} locale={locale} />
          <div className={createNewProjectMode ? 'lg:hidden' : ''}>{prioritySection}</div>
          <div className={createNewProjectMode ? 'lg:hidden' : ''}>{assigneeSection}</div>
        </div>
        {createNewProjectMode && (
          <aside className="hidden min-w-0 lg:block lg:transition-all lg:duration-300 lg:ease-out">
            <div className="space-y-4 rounded-xl border border-slate-700/80 bg-slate-900/80 p-4 shadow-[0_8px_24px_rgba(0,0,0,0.25)]">
              {prioritySection}{assigneeSection}
            </div>
          </aside>
        )}
      </div>
      {formFeedback && (
        <div className="px-6 pb-3">
          <div className={`rounded-lg border px-3 py-2 text-xs ${formFeedback.tone === 'error' ? 'border-rose-500/60 bg-rose-500/10 text-rose-200' : 'border-cyan-500/50 bg-cyan-500/10 text-cyan-100'}`}>
            {formFeedback.message}
          </div>
        </div>
      )}
      <div className="flex justify-end gap-3 border-t border-slate-700 px-6 py-4">
        <button type="button" onClick={onClose}
          className="rounded-lg border border-slate-700 px-4 py-2 text-sm text-slate-300 transition hover:bg-slate-800">
          {t({ ko: '취소', en: 'Cancel' })}
        </button>
        <button type="submit" disabled={!title.trim() || submitBusy}
          className="rounded-lg bg-blue-600 px-5 py-2 text-sm font-semibold text-white transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-40">
          {submitBusy ? t({ ko: '생성 중...', en: 'Creating...' }) : t({ ko: '업무 만들기', en: 'Create Task' })}
        </button>
      </div>
    </form>
  );
}
