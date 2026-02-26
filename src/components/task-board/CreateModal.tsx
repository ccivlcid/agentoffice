import { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import type { TaskType, Agent, Department, Project } from '../../types';
import {
  getProjects, createProject, checkProjectPath, getProjectPathSuggestions,
  browseProjectPath, pickProjectPathNative, isApiRequestError,
} from '../../api';
import {
  useI18n, loadCreateTaskDrafts, saveCreateTaskDrafts, createDraftId,
  type CreateTaskDraft, type MissingPathPrompt, type FormFeedback, type Locale,
} from './taskBoardHelpers';
import { CreateModalFormBody } from './CreateModalForm';
import {
  RestorePromptOverlay, SubmitWithoutProjectOverlay,
  MissingPathOverlay, ManualPathPickerOverlay, DraftManagerOverlay,
} from './CreateModalOverlays';
import { X } from 'lucide-react';

export interface CreateModalProps {
  agents: Agent[];
  departments: Department[];
  onClose: () => void;
  onCreate: (input: { title: string; description?: string; department_id?: string; task_type?: string; priority?: number; project_id?: string; project_path?: string; assigned_agent_id?: string; }) => void;
  onAssign: (taskId: string, agentId: string) => void;
}

export function CreateModal({ agents, departments, onClose, onCreate }: CreateModalProps) {
  const { t, locale, localeTag } = useI18n();
  const initialDrafts = useMemo(() => loadCreateTaskDrafts(), []);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [departmentId, setDepartmentId] = useState('');
  const [taskType, setTaskType] = useState<TaskType>('general');
  const [priority, setPriority] = useState(3);
  const [assignAgentId, setAssignAgentId] = useState('');
  const [projectId, setProjectId] = useState('');
  const [projectQuery, setProjectQuery] = useState('');
  const [projectDropdownOpen, setProjectDropdownOpen] = useState(false);
  const [projectActiveIndex, setProjectActiveIndex] = useState(-1);
  const [projects, setProjects] = useState<Project[]>([]);
  const [projectsLoading, setProjectsLoading] = useState(false);
  const [createNewProjectMode, setCreateNewProjectMode] = useState(false);
  const [newProjectPath, setNewProjectPath] = useState('');
  const [pathSuggestionsOpen, setPathSuggestionsOpen] = useState(false);
  const [pathSuggestionsLoading, setPathSuggestionsLoading] = useState(false);
  const [pathSuggestions, setPathSuggestions] = useState<string[]>([]);
  const [missingPathPrompt, setMissingPathPrompt] = useState<MissingPathPrompt | null>(null);
  const [manualPathPickerOpen, setManualPathPickerOpen] = useState(false);
  const [nativePathPicking, setNativePathPicking] = useState(false);
  const [manualPathLoading, setManualPathLoading] = useState(false);
  const [manualPathCurrent, setManualPathCurrent] = useState('');
  const [manualPathParent, setManualPathParent] = useState<string | null>(null);
  const [manualPathEntries, setManualPathEntries] = useState<{ name: string; path: string }[]>([]);
  const [manualPathTruncated, setManualPathTruncated] = useState(false);
  const [manualPathError, setManualPathError] = useState<string | null>(null);
  const [pathApiUnsupported, setPathApiUnsupported] = useState(false);
  const [nativePickerUnsupported, setNativePickerUnsupported] = useState(false);
  const [submitBusy, setSubmitBusy] = useState(false);
  const [submitWithoutProjectPromptOpen, setSubmitWithoutProjectPromptOpen] = useState(false);
  const [formFeedback, setFormFeedback] = useState<FormFeedback | null>(null);
  const [drafts, setDrafts] = useState<CreateTaskDraft[]>(initialDrafts);
  const [restorePromptOpen, setRestorePromptOpen] = useState<boolean>(initialDrafts.length > 0);
  const [selectedRestoreDraftId, setSelectedRestoreDraftId] = useState<string | null>(initialDrafts[0]?.id ?? null);
  const [draftModalOpen, setDraftModalOpen] = useState(false);
  const [activeDraftId, setActiveDraftId] = useState<string | null>(null);
  const projectPickerRef = useRef<HTMLDivElement | null>(null);

  const filteredAgents = useMemo(() => (departmentId ? agents.filter((a) => a.department_id === departmentId) : agents), [agents, departmentId]);
  const unsupportedPathApiMessage = useMemo(() => t({ ko: '현재 서버 버전은 경로 탐색 보조 기능을 지원하지 않습니다. 경로를 직접 입력해주세요.', en: 'This server does not support path helper APIs. Enter the path manually.' }), [t]);
  const nativePickerUnavailableMessage = useMemo(() => t({ ko: '운영체제 폴더 선택기를 사용할 수 없는 환경입니다.', en: 'OS folder picker is unavailable in this environment. Use in-app browser or manual input.' }), [t]);
  const formatAllowedRootsMessage = useCallback((roots: string[]) => roots.length === 0 ? t({ ko: '허용된 프로젝트 경로 범위를 벗어났습니다.', en: 'Path is outside allowed project roots.' }) : t({ ko: `허용된 프로젝트 경로 범위를 벗어났습니다. 허용 경로: ${roots.join(', ')}`, en: `Path is outside allowed project roots. Allowed roots: ${roots.join(', ')}` }), [t]);
  const resolvePathHelperErrorMessage = useCallback((err: unknown, fallback: Record<Locale, string>) => {
    if (!isApiRequestError(err)) return t(fallback);
    if (err.status === 404) return unsupportedPathApiMessage;
    if (err.code === 'project_path_outside_allowed_roots') return formatAllowedRootsMessage(Array.isArray((err.details as { allowed_roots?: unknown })?.allowed_roots) ? ((err.details as { allowed_roots: unknown[] }).allowed_roots.filter((x): x is string => typeof x === 'string' && x.trim().length > 0)) : []);
    if (err.code === 'native_picker_unavailable') return nativePickerUnavailableMessage;
    if (err.code === 'project_path_not_directory') return t({ ko: '해당 경로는 폴더가 아닙니다.', en: 'This path is not a directory.' });
    if (err.code === 'project_path_not_found') return t({ ko: '해당 경로를 찾을 수 없습니다.', en: 'Path not found.' });
    return t(fallback);
  }, [t, unsupportedPathApiMessage, formatAllowedRootsMessage, nativePickerUnavailableMessage]);

  const persistDrafts = useCallback((updater: (prev: CreateTaskDraft[]) => CreateTaskDraft[]) => {
    setDrafts((prev) => { const next = updater(prev).sort((a, b) => b.updatedAt - a.updatedAt).slice(0, 20); saveCreateTaskDrafts(next); return next; });
  }, []);
  const applyDraft = useCallback((draft: CreateTaskDraft) => { setTitle(draft.title); setDescription(draft.description); setDepartmentId(draft.departmentId); setTaskType(draft.taskType); setPriority(draft.priority); setAssignAgentId(draft.assignAgentId); setProjectId(draft.projectId); setProjectQuery(draft.projectQuery); setCreateNewProjectMode(draft.createNewProjectMode); setNewProjectPath(draft.newProjectPath); setProjectDropdownOpen(false); setProjectActiveIndex(-1); setActiveDraftId(draft.id); }, []);
  const hasWorkingDraftData = useMemo(() => Boolean(title.trim()) || Boolean(description.trim()) || Boolean(departmentId) || taskType !== 'general' || priority !== 3 || Boolean(assignAgentId) || Boolean(projectId) || Boolean(projectQuery.trim()) || createNewProjectMode || Boolean(newProjectPath.trim()), [title, description, departmentId, taskType, priority, assignAgentId, projectId, projectQuery, createNewProjectMode, newProjectPath]);
  const saveCurrentAsDraft = useCallback(() => {
    if (!hasWorkingDraftData) return;
    const draft: CreateTaskDraft = { id: activeDraftId ?? createDraftId(), title: title.trim(), description, departmentId, taskType, priority, assignAgentId, projectId, projectQuery, createNewProjectMode, newProjectPath, updatedAt: Date.now() };
    persistDrafts((prev) => { const idx = prev.findIndex((item) => item.id === draft.id); if (idx < 0) return [draft, ...prev]; const next = [...prev]; next[idx] = draft; return next; });
    setActiveDraftId(draft.id);
  }, [hasWorkingDraftData, activeDraftId, title, description, departmentId, taskType, priority, assignAgentId, projectId, projectQuery, createNewProjectMode, newProjectPath, persistDrafts]);
  const deleteDraft = useCallback((draftId: string) => { persistDrafts((prev) => prev.filter((item) => item.id !== draftId)); setActiveDraftId((prev) => (prev === draftId ? null : prev)); }, [persistDrafts]);
  const clearDrafts = useCallback(() => { persistDrafts(() => []); setActiveDraftId(null); }, [persistDrafts]);
  const handleRequestClose = useCallback(() => { if (!submitBusy) saveCurrentAsDraft(); onClose(); }, [submitBusy, saveCurrentAsDraft, onClose]);
  useEffect(() => { if (drafts.length === 0 && restorePromptOpen) setRestorePromptOpen(false); }, [drafts.length, restorePromptOpen]);
  const restoreCandidates = useMemo(() => drafts.slice(0, 3), [drafts]);
  const selectedRestoreDraft = useMemo(() => restoreCandidates.find((item) => item.id === selectedRestoreDraftId) ?? restoreCandidates[0] ?? null, [restoreCandidates, selectedRestoreDraftId]);
  useEffect(() => { if (restoreCandidates.length === 0) { if (selectedRestoreDraftId !== null) setSelectedRestoreDraftId(null); return; } if (!restoreCandidates.some((item) => item.id === selectedRestoreDraftId)) setSelectedRestoreDraftId(restoreCandidates[0].id); }, [restoreCandidates, selectedRestoreDraftId]);

  useEffect(() => { let cancelled = false; setProjectsLoading(true); getProjects({ page: 1, page_size: 50 }).then((res) => { if (!cancelled) setProjects(res.projects); }).catch(() => { if (!cancelled) setProjects([]); }).finally(() => { if (!cancelled) setProjectsLoading(false); }); return () => { cancelled = true; }; }, []);
  useEffect(() => { const selected = projectId ? projects.find((p) => p.id === projectId) : undefined; if (selected) setProjectQuery(selected.name); }, [projectId, projects]);
  useEffect(() => { const handler = (event: MouseEvent) => { if (!projectPickerRef.current?.contains(event.target as Node)) { setProjectDropdownOpen(false); setProjectActiveIndex(-1); } }; window.addEventListener('mousedown', handler); return () => window.removeEventListener('mousedown', handler); }, []);
  const selectedProject = useMemo(() => (projectId ? projects.find((p) => p.id === projectId) ?? null : null), [projectId, projects]);
  const filteredProjects = useMemo(() => { const q = projectQuery.trim().toLowerCase(); if (!q) return projects.slice(0, 30); return projects.filter((p) => p.name.toLowerCase().includes(q) || p.project_path.toLowerCase().includes(q) || p.core_goal.toLowerCase().includes(q)).slice(0, 30); }, [projects, projectQuery]);
  useEffect(() => { if (!projectDropdownOpen) { setProjectActiveIndex(-1); return; } const selectedIdx = selectedProject ? filteredProjects.findIndex((p) => p.id === selectedProject.id) : -1; setProjectActiveIndex(selectedIdx >= 0 ? selectedIdx : (filteredProjects.length > 0 ? 0 : -1)); }, [projectDropdownOpen, filteredProjects, selectedProject]);
  useEffect(() => { if (!createNewProjectMode) { setPathSuggestionsOpen(false); setPathSuggestions([]); setMissingPathPrompt(null); setManualPathPickerOpen(false); setSubmitWithoutProjectPromptOpen(false); } }, [createNewProjectMode]);
  useEffect(() => { if (!createNewProjectMode || !pathSuggestionsOpen || pathApiUnsupported) return; let cancelled = false; setPathSuggestionsLoading(true); getProjectPathSuggestions(newProjectPath.trim(), 30).then((paths) => { if (!cancelled) setPathSuggestions(paths); }).catch((err) => { if (cancelled) return; if (isApiRequestError(err) && err.status === 404) { setPathApiUnsupported(true); setPathSuggestionsOpen(false); setFormFeedback({ tone: 'info', message: unsupportedPathApiMessage }); return; } setFormFeedback({ tone: 'error', message: resolvePathHelperErrorMessage(err, { ko: '경로 후보를 불러오지 못했습니다.', en: 'Failed to load path suggestions.' }) }); }).finally(() => { if (!cancelled) setPathSuggestionsLoading(false); }); return () => { cancelled = true; }; }, [createNewProjectMode, pathSuggestionsOpen, newProjectPath, pathApiUnsupported, unsupportedPathApiMessage, resolvePathHelperErrorMessage]);

  const loadManualPathEntries = useCallback(async (targetPath?: string) => {
    if (pathApiUnsupported) { setManualPathError(unsupportedPathApiMessage); return; }
    setManualPathLoading(true); setManualPathError(null);
    try {
      const result = await browseProjectPath(targetPath);
      setManualPathCurrent(result.current_path); setManualPathParent(result.parent_path); setManualPathEntries(result.entries); setManualPathTruncated(result.truncated);
    } catch (err) {
      if (isApiRequestError(err) && err.status === 404) { setPathApiUnsupported(true); setManualPathPickerOpen(false); setManualPathError(unsupportedPathApiMessage); setFormFeedback({ tone: 'info', message: unsupportedPathApiMessage }); }
      else { setManualPathError(resolvePathHelperErrorMessage(err, { ko: '경로 목록을 불러오지 못했습니다.', en: 'Failed to load directories.' })); }
      setManualPathEntries([]); setManualPathTruncated(false);
    } finally { setManualPathLoading(false); }
  }, [pathApiUnsupported, unsupportedPathApiMessage, resolvePathHelperErrorMessage]);

  const selectProject = useCallback((project: Project | null) => { setFormFeedback(null); setSubmitWithoutProjectPromptOpen(false); if (!project) { setProjectId(''); setProjectQuery(''); setProjectDropdownOpen(false); setProjectActiveIndex(-1); setCreateNewProjectMode(false); setNewProjectPath(''); return; } setProjectId(project.id); setProjectQuery(project.name); setProjectDropdownOpen(false); setProjectActiveIndex(-1); setCreateNewProjectMode(false); setNewProjectPath(''); }, []);
  const handleProjectInputKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => { if (e.key === 'Escape') { setProjectDropdownOpen(false); setProjectActiveIndex(-1); return; } if (e.key === 'ArrowDown') { e.preventDefault(); setProjectDropdownOpen(true); setProjectActiveIndex((prev) => filteredProjects.length === 0 ? -1 : prev < 0 ? 0 : Math.min(prev + 1, filteredProjects.length - 1)); return; } if (e.key === 'ArrowUp') { e.preventDefault(); setProjectDropdownOpen(true); setProjectActiveIndex((prev) => filteredProjects.length === 0 ? -1 : prev < 0 ? filteredProjects.length - 1 : Math.max(prev - 1, 0)); return; } if (e.key === 'Enter' && projectDropdownOpen && projectActiveIndex >= 0 && projectActiveIndex < filteredProjects.length) { e.preventDefault(); selectProject(filteredProjects[projectActiveIndex]); } }, [filteredProjects, projectActiveIndex, projectDropdownOpen, selectProject]);

  async function submitTask(options?: { allowCreateMissingPath?: boolean; allowWithoutProject?: boolean }) {
    const allowCreateMissingPath = options?.allowCreateMissingPath ?? false;
    const allowWithoutProject = options?.allowWithoutProject ?? false;
    if (!title.trim() || submitBusy) return;
    setFormFeedback(null); setSubmitWithoutProjectPromptOpen(false);
    let resolvedProject = selectedProject;
    if (!resolvedProject && projectQuery.trim()) { const q = projectQuery.trim().toLowerCase(); const exact = projects.find((p) => p.name.toLowerCase() === q || p.project_path.toLowerCase() === q); if (exact) resolvedProject = exact; else { const m = projects.filter((p) => p.name.toLowerCase().startsWith(q) || p.project_path.toLowerCase().startsWith(q)); if (m.length === 1) resolvedProject = m[0]; } }
    if (projectId && !resolvedProject) { setFormFeedback({ tone: 'error', message: t({ ko: '선택한 프로젝트를 찾을 수 없습니다.', en: 'The selected project was not found.' }) }); return; }
    if (!resolvedProject && projectQuery.trim() && !createNewProjectMode) { setFormFeedback({ tone: 'error', message: t({ ko: '입력한 프로젝트를 확정할 수 없습니다. 목록에서 선택하거나 비워두고 진행해주세요.', en: 'Could not resolve the typed project. Pick from the list or clear it to continue.' }) }); setProjectDropdownOpen(true); return; }
    if (!resolvedProject && createNewProjectMode) {
      const projectName = projectQuery.trim(); const coreGoal = description.trim();
      if (!projectName) { setFormFeedback({ tone: 'error', message: t({ ko: '신규 프로젝트명을 입력해주세요.', en: 'Please enter a new project name.' }) }); return; }
      if (!newProjectPath.trim()) { setFormFeedback({ tone: 'error', message: t({ ko: '신규 프로젝트 경로를 입력해주세요.', en: 'Please enter a new project path.' }) }); return; }
      if (!coreGoal) { setFormFeedback({ tone: 'error', message: t({ ko: '신규 프로젝트 생성 시 설명은 필수입니다.', en: 'Description is required for new project creation.' }) }); return; }
      setSubmitBusy(true);
      try {
        const rawPath = newProjectPath.trim(); let normalizedPath = rawPath; let createPathIfMissing = true;
        try {
          const pathCheck = await checkProjectPath(rawPath); normalizedPath = pathCheck.normalized_path || rawPath;
          if (normalizedPath !== rawPath) setNewProjectPath(normalizedPath);
          if (pathCheck.exists && !pathCheck.is_directory) { setFormFeedback({ tone: 'error', message: t({ ko: '입력한 경로가 폴더가 아닙니다.', en: 'The path is not a directory.' }) }); return; }
          if (!pathCheck.exists && !allowCreateMissingPath) { setMissingPathPrompt({ normalizedPath, canCreate: pathCheck.can_create, nearestExistingParent: pathCheck.nearest_existing_parent }); return; }
          createPathIfMissing = !pathCheck.exists && allowCreateMissingPath;
        } catch (pathCheckErr) {
          if (isApiRequestError(pathCheckErr) && pathCheckErr.status === 404) { setPathApiUnsupported(true); setFormFeedback({ tone: 'info', message: unsupportedPathApiMessage }); createPathIfMissing = true; }
          else { setFormFeedback({ tone: 'error', message: resolvePathHelperErrorMessage(pathCheckErr, { ko: '프로젝트 경로 확인에 실패했습니다.', en: 'Failed to verify project path.' }) }); return; }
        }
        const created = await createProject({ name: projectName, project_path: normalizedPath, core_goal: coreGoal, create_path_if_missing: createPathIfMissing });
        setMissingPathPrompt(null); resolvedProject = created; setProjectId(created.id); setProjectQuery(created.name); setCreateNewProjectMode(false);
        setProjects((prev) => prev.some((p) => p.id === created.id) ? prev : [created, ...prev]);
      } catch (err) {
        if (isApiRequestError(err) && err.code === 'project_path_conflict') {
          const d = (err.details as { existing_project_id?: unknown; existing_project_name?: unknown; existing_project_path?: unknown } | null) ?? null;
          const existingId = typeof d?.existing_project_id === 'string' ? d.existing_project_id : ''; const existingName = typeof d?.existing_project_name === 'string' ? d.existing_project_name : ''; const existingPath = typeof d?.existing_project_path === 'string' ? d.existing_project_path : '';
          const ep = projects.find((p) => (existingId && p.id === existingId) || (existingPath && p.project_path === existingPath));
          if (ep) selectProject(ep); else { setCreateNewProjectMode(false); setProjectDropdownOpen(true); void getProjects({ page: 1, page_size: 50 }).then((res) => setProjects(res.projects)).catch(console.error); }
          setFormFeedback({ tone: 'info', message: t({ ko: existingName ? `이미 '${existingName}' 프로젝트에서 사용 중인 경로입니다.` : '이미 등록된 프로젝트 경로입니다.', en: existingName ? `This path is already used by '${existingName}'.` : 'This path is already used by another project.' }) }); return;
        }
        if (isApiRequestError(err) && err.code === 'project_path_not_found') { const d = (err.details as { normalized_path?: unknown; can_create?: unknown; nearest_existing_parent?: unknown } | null) ?? null; setMissingPathPrompt({ normalizedPath: typeof d?.normalized_path === 'string' ? d.normalized_path : newProjectPath.trim(), canCreate: Boolean(d?.can_create), nearestExistingParent: typeof d?.nearest_existing_parent === 'string' ? d.nearest_existing_parent : null }); return; }
        setFormFeedback({ tone: 'error', message: resolvePathHelperErrorMessage(err, { ko: '신규 프로젝트 생성에 실패했습니다.', en: 'Failed to create a new project.' }) }); return;
      } finally { setSubmitBusy(false); }
    }
    if (!resolvedProject && !allowWithoutProject) { setSubmitWithoutProjectPromptOpen(true); return; }
    setSubmitBusy(true);
    try {
      await Promise.resolve(onCreate({ title: title.trim(), description: description.trim() || undefined, department_id: departmentId || undefined, task_type: taskType, priority, project_id: resolvedProject?.id, project_path: resolvedProject?.project_path, assigned_agent_id: assignAgentId || undefined }));
      onClose();
    } catch { setFormFeedback({ tone: 'error', message: t({ ko: '업무 생성 중 오류가 발생했습니다.', en: 'Failed to create task.' }) }); }
    finally { setSubmitBusy(false); }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/60 p-3 backdrop-blur-sm sm:items-center sm:p-4" onClick={(e) => { if (e.target === e.currentTarget) e.preventDefault(); }}>
      <div className={`my-3 flex max-h-[calc(100dvh-2rem)] w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-slate-700 bg-slate-900 shadow-2xl transition-[max-width] duration-300 ease-out sm:my-0 sm:max-h-[90dvh] lg:max-h-none lg:max-w-2xl ${createNewProjectMode ? 'lg:max-w-5xl' : ''}`}>
        <div className="flex items-center justify-between border-b border-slate-700 px-6 py-5">
          <h2 className="text-lg font-bold text-white">{t({ ko: '새 업무 만들기', en: 'Create New Task' })}</h2>
          <div className="flex items-center gap-2">
            <button type="button" onClick={() => { setRestorePromptOpen(false); setDraftModalOpen(true); }}
              className="rounded-lg border border-slate-700 px-2.5 py-1.5 text-xs text-slate-200 transition hover:bg-slate-800">
              {`[${t({ ko: '임시', en: 'Temp' })}(${drafts.length})]`}
            </button>
            <button onClick={handleRequestClose} className="rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-800 hover:text-white" title={t({ ko: '닫기', en: 'Close' })} aria-label={t({ ko: '닫기', en: 'Close' })}><X width={18} height={18} /></button>
          </div>
        </div>
        <CreateModalFormBody
          title={title} description={description} departmentId={departmentId} taskType={taskType}
          priority={priority} assignAgentId={assignAgentId} departments={departments} agents={agents}
          filteredAgents={filteredAgents} createNewProjectMode={createNewProjectMode}
          formFeedback={formFeedback} submitBusy={submitBusy} locale={locale} t={t}
          onTitleChange={(v) => { setTitle(v); setFormFeedback(null); }}
          onDescriptionChange={(v) => { setDescription(v); setFormFeedback(null); }}
          onDepartmentChange={(v) => { setFormFeedback(null); setDepartmentId(v); setAssignAgentId(''); }}
          onTaskTypeChange={(v) => { setTaskType(v); setFormFeedback(null); }}
          onPriorityChange={(v) => { setPriority(v); setFormFeedback(null); }}
          onAssignAgentChange={(v) => { setAssignAgentId(v); setFormFeedback(null); }}
          onClose={handleRequestClose}
          onSubmit={() => void submitTask()}
          projectPickerProps={{
            projectQuery, projectDropdownOpen, projectsLoading, filteredProjects, projectActiveIndex, selectedProject,
            createNewProjectMode, newProjectPath, pathSuggestionsOpen, pathSuggestionsLoading, pathSuggestions,
            missingPathPrompt, pathApiUnsupported, nativePathPicking, nativePickerUnsupported,
            pickerRef: projectPickerRef, projects,
            onQueryChange: (v) => { setFormFeedback(null); setSubmitWithoutProjectPromptOpen(false); setProjectQuery(v); setProjectId(''); setProjectDropdownOpen(true); setCreateNewProjectMode(false); setNewProjectPath(''); },
            onFocusInput: () => setProjectDropdownOpen(true),
            onToggleDropdown: () => setProjectDropdownOpen((prev) => !prev),
            onKeyDown: handleProjectInputKeyDown,
            onSelectNull: () => selectProject(null),
            onSelectProject: selectProject,
            onSetActiveIndex: setProjectActiveIndex,
            onStartNewProject: () => { setFormFeedback(null); setCreateNewProjectMode(true); setProjectDropdownOpen(false); },
            onPathChange: (v) => { setNewProjectPath(v); setMissingPathPrompt(null); setFormFeedback(null); },
            onToggleSuggestions: () => { setFormFeedback(null); setPathSuggestionsOpen((prev) => !prev); },
            onOpenManualPicker: () => { setFormFeedback(null); setManualPathPickerOpen(true); void loadManualPathEntries(newProjectPath.trim() || undefined); },
            onNativePick: async () => { setNativePathPicking(true); try { const picked = await pickProjectPathNative(); if (!picked.cancelled && picked.path) { setNewProjectPath(picked.path); setMissingPathPrompt(null); setPathSuggestionsOpen(false); setFormFeedback(null); } } catch (err) { if (isApiRequestError(err) && err.status === 404) { setPathApiUnsupported(true); setFormFeedback({ tone: 'info', message: unsupportedPathApiMessage }); } else { const msg = resolvePathHelperErrorMessage(err, { ko: '운영체제 폴더 선택기를 열지 못했습니다.', en: 'Failed to open OS folder picker.' }); if (isApiRequestError(err) && (err.code === 'native_picker_unavailable' || err.code === 'native_picker_failed')) { setNativePickerUnsupported(true); setFormFeedback({ tone: 'info', message: msg }); } else { setFormFeedback({ tone: 'error', message: msg }); } } } finally { setNativePathPicking(false); } },
            onPickSuggestion: (path) => { setNewProjectPath(path); setMissingPathPrompt(null); setPathSuggestionsOpen(false); },
          }}
        />
      </div>

      {restorePromptOpen && selectedRestoreDraft && (
        <RestorePromptOverlay restoreCandidates={restoreCandidates} selectedRestoreDraft={selectedRestoreDraft} selectedRestoreDraftId={selectedRestoreDraftId} localeTag={localeTag}
          onSelectDraft={setSelectedRestoreDraftId} onClose={() => setRestorePromptOpen(false)} onLoad={() => { applyDraft(selectedRestoreDraft); setRestorePromptOpen(false); }} />
      )}
      {submitWithoutProjectPromptOpen && (
        <SubmitWithoutProjectOverlay onClose={() => setSubmitWithoutProjectPromptOpen(false)} onConfirm={() => { setSubmitWithoutProjectPromptOpen(false); void submitTask({ allowWithoutProject: true }); }} />
      )}
      {missingPathPrompt && (
        <MissingPathOverlay prompt={missingPathPrompt} submitBusy={submitBusy} onClose={() => setMissingPathPrompt(null)} onConfirm={() => { setMissingPathPrompt(null); void submitTask({ allowCreateMissingPath: true }); }} />
      )}
      {manualPathPickerOpen && (
        <ManualPathPickerOverlay manualPathCurrent={manualPathCurrent} manualPathParent={manualPathParent} manualPathEntries={manualPathEntries} manualPathTruncated={manualPathTruncated} manualPathLoading={manualPathLoading} manualPathError={manualPathError}
          onClose={() => setManualPathPickerOpen(false)} onNavigate={(path) => void loadManualPathEntries(path || undefined)}
          onSelect={(path) => { setNewProjectPath(path); setMissingPathPrompt(null); setManualPathPickerOpen(false); }} />
      )}
      {draftModalOpen && (
        <DraftManagerOverlay drafts={drafts} localeTag={localeTag} onClose={() => setDraftModalOpen(false)}
          onLoad={(draft) => { applyDraft(draft); setDraftModalOpen(false); }} onDelete={deleteDraft} onClearAll={clearDrafts} />
      )}
    </div>
  );
}
