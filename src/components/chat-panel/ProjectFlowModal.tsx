import type { Project } from '../../types';
import type { ProjectFlowStep, PendingSendAction } from './chatPanelTypes';
import { X, Target } from 'lucide-react';
import { Icon } from '../ui/Icon';

interface ProjectFlowModalProps {
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
  tr: (ko: string, en: string, ja?: string, zh?: string) => string;
  onClose: () => void;
  onSetStep: (step: ProjectFlowStep) => void;
  onSetExistingInput: (val: string) => void;
  onSetExistingError: (val: string) => void;
  onSetNewName: (val: string) => void;
  onSetNewPath: (val: string) => void;
  onSetNewGoal: (val: string) => void;
  onSelectProject: (p: Project) => void;
  onApplyExistingSelection: () => void;
  onCreateProject: () => void;
  onConfirmProject: () => void;
  onLoadRecentProjects: () => void;
}

export function ProjectFlowModal({
  step,
  items,
  loading,
  selected,
  existingInput,
  existingError,
  newName,
  newPath,
  newGoal,
  saving,
  pendingSend,
  isDirectivePending,
  tr,
  onClose,
  onSetStep,
  onSetExistingInput,
  onSetExistingError,
  onSetNewName,
  onSetNewPath,
  onSetNewGoal,
  onSelectProject,
  onApplyExistingSelection,
  onCreateProject,
  onConfirmProject,
  onLoadRecentProjects,
}: ProjectFlowModalProps) {
  return (
    <div className="absolute inset-0 z-[70] flex items-center justify-center bg-black/75 p-4">
      <div className="w-full max-w-md rounded-xl border border-slate-700 bg-slate-900 shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-700 px-4 py-3">
          <h3 className="text-sm font-semibold text-white">
            {tr('프로젝트 분기', 'Project Branch')}
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1 text-slate-400 hover:bg-slate-800 hover:text-white"
            aria-label={tr('닫기', 'Close')}
          >
            <X width={18} height={18} />
          </button>
        </div>

        <div className="space-y-3 px-4 py-4 text-sm">
          {step === 'choose' && (
            <>
              <p className="text-slate-200">
                {tr(
                  '기존 프로젝트인가요? 신규 프로젝트인가요?',
                  'Is this an existing project or a new project?',
                )}
              </p>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    onSetStep('existing');
                    onSetExistingInput('');
                    onSetExistingError('');
                    onLoadRecentProjects();
                  }}
                  className="flex-1 rounded-lg bg-blue-600 px-3 py-2 text-xs font-medium text-white hover:bg-blue-500"
                >
                  {tr('기존 프로젝트', 'Existing Project')}
                </button>
                <button
                  type="button"
                  onClick={() => onSetStep('new')}
                  className="flex-1 rounded-lg bg-emerald-600 px-3 py-2 text-xs font-medium text-white hover:bg-emerald-500"
                >
                  {tr('신규 프로젝트', 'New Project')}
                </button>
              </div>
            </>
          )}

          {step === 'existing' && (
            <>
              <p className="text-xs text-slate-400">
                {tr(
                  '최근 프로젝트 10개를 보여드립니다. 번호(1-10) 또는 프로젝트명을 입력하세요.',
                  'Showing 10 recent projects. Enter a number (1-10) or project name.',
                )}
              </p>
              {loading ? (
                <p className="text-xs text-slate-500">{tr('불러오는 중...', 'Loading...')}</p>
              ) : items.length === 0 ? (
                <p className="text-xs text-slate-500">{tr('프로젝트가 없습니다', 'No projects')}</p>
              ) : (
                <div className="max-h-52 space-y-2 overflow-y-auto pr-1">
                  {items.map((p, idx) => (
                    <div key={p.id} className="rounded-lg border border-slate-700 bg-slate-800/60 p-2">
                      <p className="text-xs font-medium text-slate-100">
                        <span className="mr-1 text-blue-300">{idx + 1}.</span>
                        {p.name}
                      </p>
                      <p className="truncate text-[11px] text-slate-400">{p.project_path}</p>
                      <button
                        type="button"
                        onClick={() => {
                          onSelectProject(p);
                          onSetExistingInput(String(idx + 1));
                          onSetExistingError('');
                          onSetStep('confirm');
                        }}
                        className="mt-2 rounded bg-blue-700 px-2 py-1 text-[11px] text-white hover:bg-blue-600"
                      >
                        {tr('선택', 'Select')}
                      </button>
                    </div>
                  ))}
                </div>
              )}
              <div className="space-y-2 pt-1">
                <input
                  type="text"
                  value={existingInput}
                  onChange={(e) => {
                    onSetExistingInput(e.target.value);
                    if (existingError) onSetExistingError('');
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      onApplyExistingSelection();
                    }
                  }}
                  placeholder={tr(
                    '예: 1 또는 프로젝트명',
                    'e.g. 1 or project name',
                    '例: 1 またはプロジェクト名',
                    '例如：1 或项目名',
                  )}
                  className="w-full rounded border border-slate-700 bg-slate-800 px-2 py-1.5 text-xs text-slate-100 outline-none focus:border-blue-500"
                />
                {existingError && (
                  <p className="text-[11px] text-rose-300">{existingError}</p>
                )}
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={onApplyExistingSelection}
                    className="flex-1 rounded bg-blue-700 px-2 py-1.5 text-[11px] text-white hover:bg-blue-600"
                  >
                    {tr('입력값으로 선택', 'Select from input')}
                  </button>
                  <button
                    type="button"
                    onClick={() => onSetStep('choose')}
                    className="rounded border border-slate-700 px-2 py-1.5 text-[11px] text-slate-300"
                  >
                    {tr('뒤로', 'Back')}
                  </button>
                </div>
              </div>
            </>
          )}

          {step === 'new' && (
            <>
              <input
                type="text"
                value={newName}
                onChange={(e) => onSetNewName(e.target.value)}
                placeholder={tr('프로젝트 이름', 'Project name')}
                className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-xs text-white outline-none focus:border-blue-500"
              />
              <input
                type="text"
                value={newPath}
                onChange={(e) => onSetNewPath(e.target.value)}
                placeholder={tr('프로젝트 경로', 'Project path')}
                className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-xs text-white outline-none focus:border-blue-500"
              />
              <textarea
                rows={3}
                value={newGoal}
                onChange={(e) => onSetNewGoal(e.target.value)}
                readOnly={isDirectivePending}
                placeholder={tr('핵심 목표', 'Core goal', 'コア目標', '核心目标')}
                className="w-full resize-none rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-xs text-white outline-none focus:border-blue-500"
              />
              {isDirectivePending && (
                <p className="text-[11px] text-slate-400">
                  {tr(
                    '$ 업무지시 내용이 신규 프로젝트의 핵심 목표로 자동 반영됩니다.',
                    'The $ directive text is automatically used as the new project core goal.',
                  )}
                </p>
              )}
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={onCreateProject}
                  disabled={
                    !newName.trim()
                    || !newPath.trim()
                    || !(isDirectivePending ? (pendingSend?.content ?? '').trim() : newGoal.trim())
                    || saving
                  }
                  className="flex-1 rounded bg-emerald-700 px-3 py-2 text-xs font-medium text-white hover:bg-emerald-600 disabled:opacity-40"
                >
                  {saving
                    ? tr('등록 중...', 'Creating...')
                    : tr('등록 후 선택', 'Create & Select')}
                </button>
                <button
                  type="button"
                  onClick={() => onSetStep('choose')}
                  className="rounded border border-slate-700 px-3 py-2 text-xs text-slate-300"
                >
                  {tr('뒤로', 'Back', '戻る', '返回')}
                </button>
              </div>
            </>
          )}

          {step === 'confirm' && selected && (
            <>
              <div className="rounded-lg border border-slate-700 bg-slate-800/60 p-3">
                <p className="text-xs font-semibold text-white">{selected.name}</p>
                <p className="mt-1 text-[11px] text-slate-400">{selected.project_path}</p>
                <p className="mt-1 text-[11px] text-slate-300">{selected.core_goal}</p>
              </div>
              {selected.assignment_mode === 'manual' && (selected.assigned_agent_ids?.length ?? 0) > 0 && (
                <div className="rounded-lg border border-amber-700/40 bg-amber-900/20 p-2 text-[11px] text-amber-200">
                  <span className="font-medium inline-flex items-center gap-1"><Icon icon={Target} size="xs" aria-hidden /> {tr(
                    `Manual mode — ${selected.assigned_agent_ids!.length}명의 지정 에이전트가 이 작업을 수행합니다`,
                    `Manual mode — ${selected.assigned_agent_ids!.length} assigned agents will work on this`
                  )}</span>
                </div>
              )}
              <div className="rounded-lg border border-blue-700/40 bg-blue-900/20 p-3 text-[11px] text-blue-100">
                <p className="font-medium">{tr('라운드 목표', 'Round Goal')}</p>
                <p className="mt-1 leading-relaxed">
                  {tr(
                    `프로젝트 핵심목표(${selected.core_goal})를 기준으로 이번 요청(${pendingSend?.content ?? ''})을 실행 가능한 산출물로 완수`,
                    `Execute this round with project core goal (${selected.core_goal}) and current request (${pendingSend?.content ?? ''}).`,

                  )}
                </p>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={onConfirmProject}
                  className="flex-1 rounded bg-blue-600 px-3 py-2 text-xs font-medium text-white hover:bg-blue-500"
                >
                  {tr('선택 후 전송', 'Select & Send')}
                </button>
                <button
                  type="button"
                  onClick={() => onSetStep('choose')}
                  className="rounded border border-slate-700 px-3 py-2 text-xs text-slate-300"
                >
                  {tr('다시 선택', 'Re-select')}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
