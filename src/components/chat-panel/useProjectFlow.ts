import { useState, useCallback } from 'react';
import type { Project } from '../../types';
import type { PendingSendAction, ProjectFlowStep, ProjectMetaPayload } from './chatPanelTypes';
import { createProject, getProjects } from '../../api';

export interface ProjectFlowActions {
  dispatchSend: (
    action: PendingSendAction,
    projectMeta: ProjectMetaPayload,
  ) => void;
  clearInput: () => void;
  focusTextarea: () => void;
}

export interface UseProjectFlowReturn {
  open: boolean;
  step: ProjectFlowStep;
  items: Project[];
  loading: boolean;
  selected: Project | null;
  existingInput: string;
  existingError: string;
  newName: string;
  newPath: string;
  newGoal: string;
  saving: boolean;
  pendingSend: PendingSendAction | null;
  isDirectivePending: boolean;
  openFlow: (action: PendingSendAction) => void;
  closeFlow: () => void;
  setStep: (step: ProjectFlowStep) => void;
  setExistingInput: (val: string) => void;
  setExistingError: (val: string) => void;
  setNewName: (val: string) => void;
  setNewPath: (val: string) => void;
  setNewGoal: (val: string) => void;
  selectProject: (p: Project) => void;
  loadRecentProjects: () => Promise<void>;
  applyExistingSelection: (errorMsg: string) => void;
  handleCreateProject: () => Promise<void>;
  handleConfirm: (actions: ProjectFlowActions) => void;
}

export function useProjectFlow(): UseProjectFlowReturn {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<ProjectFlowStep>('choose');
  const [items, setItems] = useState<Project[]>([]);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<Project | null>(null);
  const [existingInput, setExistingInput] = useState('');
  const [existingError, setExistingError] = useState('');
  const [newName, setNewName] = useState('');
  const [newPath, setNewPath] = useState('');
  const [newGoal, setNewGoal] = useState('');
  const [saving, setSaving] = useState(false);
  const [pendingSend, setPendingSend] = useState<PendingSendAction | null>(null);

  const isDirectivePending = pendingSend?.kind === 'directive';

  const closeFlow = useCallback(() => {
    setOpen(false);
    setStep('choose');
    setPendingSend(null);
    setSelected(null);
    setExistingInput('');
    setExistingError('');
    setNewName('');
    setNewPath('');
    setNewGoal('');
    setItems([]);
  }, []);

  const openFlow = useCallback((action: PendingSendAction) => {
    setPendingSend(action);
    setOpen(true);
    setStep('choose');
    setSelected(null);
    setExistingInput('');
    setExistingError('');
    setItems([]);
    setNewGoal(action.kind === 'directive' ? action.content : '');
  }, []);

  const loadRecentProjects = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getProjects({ page: 1, page_size: 10 });
      setItems(res.projects.slice(0, 10));
    } catch (err) {
      console.error('Failed to load projects:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  const resolveSelection = useCallback(
    (raw: string): Project | null => {
      const trimmed = raw.trim();
      if (!trimmed || items.length === 0) return null;
      if (/^\d+$/.test(trimmed)) {
        const idx = Number.parseInt(trimmed, 10);
        if (idx >= 1 && idx <= items.length) return items[idx - 1];
      }
      const query = trimmed.toLowerCase();
      const tokens = query.split(/\s+/).filter(Boolean);
      let best: { project: Project; score: number } | null = null;
      for (const p of items) {
        const name = p.name.toLowerCase();
        const path = p.project_path.toLowerCase();
        const goal = p.core_goal.toLowerCase();
        let score = 0;
        if (name === query) score = Math.max(score, 100);
        if (name.startsWith(query)) score = Math.max(score, 90);
        if (name.includes(query)) score = Math.max(score, 80);
        if (path === query) score = Math.max(score, 75);
        if (path.includes(query)) score = Math.max(score, 65);
        if (goal.includes(query)) score = Math.max(score, 50);
        if (tokens.length > 0) {
          const hits = tokens.filter((tk) => name.includes(tk) || path.includes(tk) || goal.includes(tk)).length;
          score = Math.max(score, hits * 20);
        }
        if (!best || score > best.score) best = { project: p, score };
      }
      if (!best || best.score < 50) return null;
      return best.project;
    },
    [items],
  );

  const applyExistingSelection = useCallback(
    (errorMsg: string) => {
      const picked = resolveSelection(existingInput);
      if (!picked) {
        setExistingError(errorMsg);
        return;
      }
      setExistingError('');
      setSelected(picked);
      setStep('confirm');
    },
    [existingInput, resolveSelection],
  );

  const handleCreateProject = useCallback(async () => {
    const goal = isDirectivePending ? (pendingSend?.content ?? '').trim() : newGoal.trim();
    if (!newName.trim() || !newPath.trim() || !goal || saving) return;
    setSaving(true);
    try {
      const created = await createProject({
        name: newName.trim(),
        project_path: newPath.trim(),
        core_goal: goal,
      });
      setSelected(created);
      setStep('confirm');
    } catch (err) {
      console.error('Failed to create project:', err);
    } finally {
      setSaving(false);
    }
  }, [isDirectivePending, pendingSend, newGoal, newName, newPath, saving]);

  const handleConfirm = useCallback(
    ({ dispatchSend, clearInput, focusTextarea }: ProjectFlowActions) => {
      if (!pendingSend || !selected) return;
      const projectMeta: ProjectMetaPayload = {
        project_id: selected.id,
        project_path: selected.project_path,
        project_context: selected.core_goal,
      };
      dispatchSend(pendingSend, projectMeta);
      clearInput();
      focusTextarea();
      closeFlow();
    },
    [pendingSend, selected, closeFlow],
  );

  return {
    open, step, items, loading, selected,
    existingInput, existingError,
    newName, newPath, newGoal, saving,
    pendingSend, isDirectivePending,
    openFlow, closeFlow,
    setStep, setExistingInput, setExistingError,
    setNewName, setNewPath, setNewGoal,
    selectProject: setSelected,
    loadRecentProjects,
    applyExistingSelection,
    handleCreateProject,
    handleConfirm,
  };
}
