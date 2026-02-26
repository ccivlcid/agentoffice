import { useCallback, useEffect, useMemo, useState } from 'react';
import type { Project } from '../../types';
import {
  browseProjectPath,
  checkProjectPath,
  createProject,
  deleteProject,
  getProjectDetail,
  getProjectPathSuggestions,
  getProjects,
  getTaskReportDetail,
  isApiRequestError,
  pickProjectPathNative,
  updateProject,
  type ProjectDetailResponse,
  type TaskReportDetail,
} from '../../api';
import { useI18n } from '../../i18n';
import type { FormFeedback, ManualPathEntry, MissingPathPrompt } from './projectManagerHelpers';

const PAGE_SIZE = 5;

export function useProjectManagerLogic() {
  const { t } = useI18n();

  const [projects, setProjects] = useState<Project[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [search, setSearch] = useState('');
  const [loadingList, setLoadingList] = useState(false);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [detail, setDetail] = useState<ProjectDetailResponse | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [githubImportMode, setGithubImportMode] = useState(false);
  const [editingProjectId, setEditingProjectId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [projectPath, setProjectPath] = useState('');
  const [coreGoal, setCoreGoal] = useState('');
  const [saving, setSaving] = useState(false);
  const [pathSuggestionsOpen, setPathSuggestionsOpen] = useState(false);
  const [pathSuggestionsLoading, setPathSuggestionsLoading] = useState(false);
  const [pathSuggestions, setPathSuggestions] = useState<string[]>([]);
  const [missingPathPrompt, setMissingPathPrompt] = useState<MissingPathPrompt | null>(null);
  const [manualPathPickerOpen, setManualPathPickerOpen] = useState(false);
  const [nativePathPicking, setNativePathPicking] = useState(false);
  const [manualPathLoading, setManualPathLoading] = useState(false);
  const [manualPathCurrent, setManualPathCurrent] = useState('');
  const [manualPathParent, setManualPathParent] = useState<string | null>(null);
  const [manualPathEntries, setManualPathEntries] = useState<ManualPathEntry[]>([]);
  const [manualPathTruncated, setManualPathTruncated] = useState(false);
  const [manualPathError, setManualPathError] = useState<string | null>(null);
  const [pathApiUnsupported, setPathApiUnsupported] = useState(false);
  const [nativePickerUnsupported, setNativePickerUnsupported] = useState(false);
  const [formFeedback, setFormFeedback] = useState<FormFeedback | null>(null);
  const [reportDetail, setReportDetail] = useState<TaskReportDetail | null>(null);
  const [assignmentMode, setAssignmentMode] = useState<'auto' | 'manual'>('auto');
  const [selectedAgentIds, setSelectedAgentIds] = useState<string[]>([]);
  const [showAssignSafeguard, setShowAssignSafeguard] = useState(false);

  const loadProjects = useCallback(async (targetPage: number, keyword: string) => {
    setLoadingList(true);
    try {
      const res = await getProjects({ page: targetPage, page_size: PAGE_SIZE, search: keyword.trim() || undefined });
      setProjects(res.projects);
      setPage(res.page);
      setTotalPages(Math.max(1, res.total_pages || 1));
      if (res.projects.length === 0) setIsCreating(true);
      if (!selectedProjectId && res.projects[0]) setSelectedProjectId(res.projects[0].id);
    } catch (err) {
      console.error('Failed to load projects:', err);
    } finally {
      setLoadingList(false);
    }
  }, [selectedProjectId]);

  useEffect(() => { void loadProjects(1, search); }, []);

  useEffect(() => {
    if (!selectedProjectId) { setDetail(null); return; }
    setLoadingDetail(true);
    getProjectDetail(selectedProjectId)
      .then((res) => {
        setDetail(res);
        if (!editingProjectId && !isCreating) {
          setName(res.project.name);
          setProjectPath(res.project.project_path);
          setCoreGoal(res.project.core_goal);
        }
      })
      .catch((err) => console.error('Failed to load project detail:', err))
      .finally(() => setLoadingDetail(false));
  }, [selectedProjectId, editingProjectId, isCreating]);

  const viewedProject = detail?.project ?? null;
  const selectedProject = isCreating ? null : viewedProject;
  const canSave = !!name.trim() && !!projectPath.trim() && !!coreGoal.trim();
  const pathToolsVisible = isCreating || !!editingProjectId;

  const unsupportedPathApiMessage = useMemo(() => t({
    ko: '현재 서버 버전은 경로 탐색 보조 기능을 지원하지 않습니다. 경로를 직접 입력해주세요.',
    en: 'This server does not support path helper APIs. Enter the path manually.',
}), [t]);

  const nativePickerUnavailableMessage = useMemo(() => t({
    ko: '운영체제 폴더 선택기를 사용할 수 없는 환경입니다. 앱 내 폴더 탐색 또는 직접 입력을 사용해주세요.',
    en: 'OS folder picker is unavailable in this environment. Use in-app browser or manual input.',
}), [t]);

  const formatAllowedRootsMessage = useCallback((allowedRoots: string[]) => {
    if (allowedRoots.length === 0) return t({ ko: '허용된 프로젝트 경로 범위를 벗어났습니다.', en: 'Path is outside allowed project roots.' });
    return t({ ko: `허용된 프로젝트 경로 범위를 벗어났습니다. 허용 경로: ${allowedRoots.join(', ')}`, en: `Path is outside allowed project roots. Allowed roots: ${allowedRoots.join(', ')}` });
  }, [t]);

  const resolvePathHelperErrorMessage = useCallback((err: unknown, fallback: { ko: string; en: string }) => {
    if (!isApiRequestError(err)) return t(fallback);
    if (err.status === 404) return unsupportedPathApiMessage;
    if (err.code === 'project_path_outside_allowed_roots') {
      const allowedRoots = Array.isArray((err.details as { allowed_roots?: unknown })?.allowed_roots)
        ? ((err.details as { allowed_roots: unknown[] }).allowed_roots.filter((item): item is string => typeof item === 'string' && item.trim().length > 0))
        : [];
      return formatAllowedRootsMessage(allowedRoots);
    }
    if (err.code === 'native_picker_unavailable') return nativePickerUnavailableMessage;
    if (err.code === 'project_path_not_directory') return t({ ko: '해당 경로는 폴더가 아닙니다. 디렉터리 경로를 입력해주세요.', en: 'This path is not a directory. Please enter a directory path.' });
    if (err.code === 'project_path_not_found') return t({ ko: '해당 경로를 찾을 수 없습니다.', en: 'Path not found.' });
    return t(fallback);
  }, [t, unsupportedPathApiMessage, formatAllowedRootsMessage, nativePickerUnavailableMessage]);

  const resetPathHelperState = useCallback(() => {
    setPathSuggestionsOpen(false); setPathSuggestionsLoading(false); setPathSuggestions([]);
    setMissingPathPrompt(null); setManualPathPickerOpen(false); setNativePathPicking(false);
    setManualPathLoading(false); setManualPathCurrent(''); setManualPathParent(null);
    setManualPathEntries([]); setManualPathTruncated(false); setManualPathError(null); setFormFeedback(null);
  }, []);

  useEffect(() => { if (pathToolsVisible) return; resetPathHelperState(); }, [pathToolsVisible, resetPathHelperState]);

  useEffect(() => {
    if (!pathToolsVisible || !pathSuggestionsOpen || pathApiUnsupported) return;
    let cancelled = false;
    setPathSuggestionsLoading(true);
    getProjectPathSuggestions(projectPath.trim(), 30)
      .then((paths) => { if (cancelled) return; setPathSuggestions(paths); })
      .catch((err) => {
        if (cancelled) return;
        if (isApiRequestError(err) && err.status === 404) { setPathApiUnsupported(true); setPathSuggestionsOpen(false); setFormFeedback({ tone: 'info', message: unsupportedPathApiMessage }); return; }
        setPathSuggestions([]);
        setFormFeedback({ tone: 'error', message: resolvePathHelperErrorMessage(err, { ko: '경로 후보를 불러오지 못했습니다.', en: 'Failed to load path suggestions.' }) });
      })
      .finally(() => { if (cancelled) return; setPathSuggestionsLoading(false); });
    return () => { cancelled = true; };
  }, [pathSuggestionsOpen, pathToolsVisible, projectPath, pathApiUnsupported, unsupportedPathApiMessage, resolvePathHelperErrorMessage]);

  const loadManualPathEntries = useCallback(async (targetPath?: string) => {
    if (pathApiUnsupported) { setManualPathError(unsupportedPathApiMessage); return; }
    setManualPathLoading(true); setManualPathError(null);
    try {
      const result = await browseProjectPath(targetPath);
      setManualPathCurrent(result.current_path); setManualPathParent(result.parent_path);
      setManualPathEntries(result.entries); setManualPathTruncated(result.truncated);
    } catch (err) {
      console.error('Failed to browse project path:', err);
      if (isApiRequestError(err) && err.status === 404) {
        setPathApiUnsupported(true); setManualPathPickerOpen(false); setManualPathError(unsupportedPathApiMessage);
        setFormFeedback({ tone: 'info', message: unsupportedPathApiMessage });
      } else {
        setManualPathError(resolvePathHelperErrorMessage(err, { ko: '경로 목록을 불러오지 못했습니다.', en: 'Failed to load directories.' }));
      }
      setManualPathEntries([]); setManualPathTruncated(false);
    } finally { setManualPathLoading(false); }
  }, [pathApiUnsupported, unsupportedPathApiMessage, resolvePathHelperErrorMessage]);

  const startCreate = () => {
    setIsCreating(true); setEditingProjectId(null); setName(''); setProjectPath(''); setCoreGoal(''); resetPathHelperState();
    setAssignmentMode('auto'); setSelectedAgentIds([]);
  };

  const startEditSelected = () => {
    if (!viewedProject) return;
    setIsCreating(false); setEditingProjectId(viewedProject.id); setName(viewedProject.name);
    setProjectPath(viewedProject.project_path); setCoreGoal(viewedProject.core_goal); resetPathHelperState();
    setAssignmentMode(viewedProject.assignment_mode ?? 'auto');
    setSelectedAgentIds(viewedProject.assigned_agent_ids ?? []);
  };

  const handleSave = async (allowCreateMissingPath = false) => {
    if (!canSave || saving) return;
    setFormFeedback(null);
    let savePath = projectPath.trim();
    let createPathIfMissing = allowCreateMissingPath;
    if (!allowCreateMissingPath) {
      try {
        const pathCheck = await checkProjectPath(savePath);
        savePath = pathCheck.normalized_path || savePath;
        if (savePath !== projectPath.trim()) setProjectPath(savePath);
        if (pathCheck.exists && !pathCheck.is_directory) {
          setFormFeedback({ tone: 'error', message: t({ ko: '해당 경로는 폴더가 아닙니다. 디렉터리 경로를 입력해주세요.', en: 'This path is not a directory. Please enter a directory path.' }) });
          return;
        }
        if (!pathCheck.exists) {
          setMissingPathPrompt({ normalizedPath: pathCheck.normalized_path || savePath, canCreate: pathCheck.can_create, nearestExistingParent: pathCheck.nearest_existing_parent });
          return;
        }
        createPathIfMissing = false;
      } catch (err) {
        console.error('Failed to check project path:', err);
        if (isApiRequestError(err) && err.status === 404) { setPathApiUnsupported(true); createPathIfMissing = true; setFormFeedback({ tone: 'info', message: unsupportedPathApiMessage }); }
        else { setFormFeedback({ tone: 'error', message: resolvePathHelperErrorMessage(err, { ko: '프로젝트 경로 확인에 실패했습니다.', en: 'Failed to verify project path.' }) }); return; }
      }
    }
    setSaving(true);
    try {
      const assignPayload = assignmentMode === 'manual'
        ? { assignment_mode: 'manual' as const, agent_ids: selectedAgentIds }
        : { assignment_mode: 'auto' as const };
      if (editingProjectId) {
        const updated = await updateProject(editingProjectId, { name: name.trim(), project_path: savePath, core_goal: coreGoal.trim(), create_path_if_missing: createPathIfMissing, ...assignPayload });
        setSelectedProjectId(updated.id);
      } else {
        const created = await createProject({ name: name.trim(), project_path: savePath, core_goal: coreGoal.trim(), create_path_if_missing: createPathIfMissing, ...assignPayload });
        setSelectedProjectId(created.id);
      }
      await loadProjects(1, search); setEditingProjectId(null); setIsCreating(false); resetPathHelperState();
    } catch (err) {
      console.error('Failed to save project:', err);
      if (isApiRequestError(err) && err.code === 'project_path_conflict') {
        const details = (err.details as { existing_project_name?: unknown; existing_project_path?: unknown } | null) ?? null;
        const existingProjectName = typeof details?.existing_project_name === 'string' ? details.existing_project_name : '';
        const existingProjectPath = typeof details?.existing_project_path === 'string' ? details.existing_project_path : '';
        setFormFeedback({ tone: 'info', message: t({ ko: existingProjectName ? `동일 경로가 이미 '${existingProjectName}' 프로젝트에 등록되어 있습니다. (${existingProjectPath || 'path'})` : '동일 경로가 이미 다른 프로젝트에 등록되어 있습니다.', en: existingProjectName ? `This path is already registered by '${existingProjectName}'. (${existingProjectPath || 'path'})` : 'This path is already registered by another project.' }) });
        return;
      }
      if (isApiRequestError(err) && err.code === 'project_path_not_found') {
        const details = (err.details as { normalized_path?: unknown; can_create?: unknown; nearest_existing_parent?: unknown } | null) ?? null;
        setMissingPathPrompt({ normalizedPath: typeof details?.normalized_path === 'string' ? details.normalized_path : savePath, canCreate: Boolean(details?.can_create), nearestExistingParent: typeof details?.nearest_existing_parent === 'string' ? details.nearest_existing_parent : null });
        return;
      }
      setFormFeedback({ tone: 'error', message: resolvePathHelperErrorMessage(err, { ko: '프로젝트 저장에 실패했습니다. 입력값을 확인해주세요.', en: 'Failed to save project. Please check your inputs.' }) });
    } finally { setSaving(false); }
  };

  const handleDelete = async () => {
    if (!selectedProject) return;
    const confirmed = window.confirm(t({ ko: `프로젝트 '${selectedProject.name}' 을(를) 삭제할까요?`, en: `Delete project '${selectedProject.name}'?` }));
    if (!confirmed) return;
    try { await deleteProject(selectedProject.id); setSelectedProjectId(null); setDetail(null); await loadProjects(1, search); startCreate(); }
    catch (err) { console.error('Failed to delete project:', err); }
  };

  const handleOpenTaskDetail = async (taskId: string) => {
    try { const d = await getTaskReportDetail(taskId); setReportDetail(d); }
    catch (err) { console.error('Failed to open task detail:', err); }
  };

  const handleNativePathPick = async () => {
    setNativePathPicking(true);
    try {
      const picked = await pickProjectPathNative();
      if (picked.cancelled || !picked.path) return;
      setProjectPath(picked.path); setMissingPathPrompt(null); setPathSuggestionsOpen(false); setFormFeedback(null);
    } catch (err) {
      console.error('Failed to open native path picker:', err);
      if (isApiRequestError(err) && err.status === 404) { setPathApiUnsupported(true); setFormFeedback({ tone: 'info', message: unsupportedPathApiMessage }); }
      else {
        const message = resolvePathHelperErrorMessage(err, { ko: '운영체제 폴더 선택기를 열지 못했습니다.', en: 'Failed to open OS folder picker.' });
        if (isApiRequestError(err) && (err.code === 'native_picker_unavailable' || err.code === 'native_picker_failed')) { setNativePickerUnsupported(true); setFormFeedback({ tone: 'info', message }); }
        else { setFormFeedback({ tone: 'error', message }); }
      }
    } finally { setNativePathPicking(false); }
  };

  return {
    projects, page, totalPages, search, loadingList,
    selectedProjectId, setSelectedProjectId,
    detail, loadingDetail,
    isCreating, setIsCreating,
    githubImportMode, setGithubImportMode,
    editingProjectId, setEditingProjectId,
    name, projectPath, coreGoal,
    saving, canSave, pathToolsVisible,
    pathSuggestionsOpen, setPathSuggestionsOpen,
    pathSuggestionsLoading, pathSuggestions,
    missingPathPrompt, setMissingPathPrompt,
    manualPathPickerOpen, setManualPathPickerOpen,
    nativePathPicking, nativePickerUnsupported,
    manualPathLoading, manualPathCurrent, manualPathParent,
    manualPathEntries, manualPathTruncated, manualPathError,
    pathApiUnsupported, formFeedback,
    reportDetail, setReportDetail,
    viewedProject, selectedProject,
    setSearch,
    setName: (v: string) => { setName(v); setFormFeedback(null); },
    setProjectPath: (v: string) => { setProjectPath(v); setMissingPathPrompt(null); setFormFeedback(null); },
    setCoreGoal: (v: string) => { setCoreGoal(v); setFormFeedback(null); },
    loadProjects,
    startCreate,
    startEditSelected,
    handleSave,
    handleDelete,
    handleOpenTaskDetail,
    handleNativePathPick,
    resetPathHelperState,
    loadManualPathEntries,
    assignmentMode, setAssignmentMode,
    selectedAgentIds, setSelectedAgentIds,
    showAssignSafeguard, setShowAssignSafeguard,
  };
}