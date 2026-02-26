import type { Project, Agent } from '../../types';
import { useI18n } from '../../i18n';
import { AVATAR_ICONS } from '../../constants/icons';
import { Icon } from '../ui/Icon';
import type { FormFeedback, MissingPathPrompt } from './projectManagerHelpers';

interface ProjectManagerFormProps {
  isCreating: boolean;
  editingProjectId: string | null;
  viewedProject: Project | null;
  name: string;
  projectPath: string;
  coreGoal: string;
  canSave: boolean;
  saving: boolean;
  pathToolsVisible: boolean;
  pathApiUnsupported: boolean;
  nativePathPicking: boolean;
  nativePickerUnsupported: boolean;
  pathSuggestionsOpen: boolean;
  pathSuggestionsLoading: boolean;
  pathSuggestions: string[];
  missingPathPrompt: MissingPathPrompt | null;
  formFeedback: FormFeedback | null;
  agents?: Agent[];
  assignmentMode: 'auto' | 'manual';
  selectedAgentIds: string[];
  onAssignmentModeChange: (mode: 'auto' | 'manual') => void;
  onSelectedAgentIdsChange: (ids: string[]) => void;
  onNameChange: (value: string) => void;
  onProjectPathChange: (value: string) => void;
  onCoreGoalChange: (value: string) => void;
  onSave: () => void;
  onCancel: () => void;
  onStartEdit: () => void;
  onDelete: () => void;
  onOpenManualPicker: () => void;
  onTogglePathSuggestions: () => void;
  onPickNativePath: () => void;
  onSelectSuggestion: (path: string) => void;
}

export default function ProjectManagerForm({
  isCreating,
  editingProjectId,
  viewedProject,
  name,
  projectPath,
  coreGoal,
  canSave,
  saving,
  pathToolsVisible,
  pathApiUnsupported,
  nativePathPicking,
  nativePickerUnsupported,
  pathSuggestionsOpen,
  pathSuggestionsLoading,
  pathSuggestions,
  missingPathPrompt,
  formFeedback,
  agents = [],
  assignmentMode,
  selectedAgentIds,
  onAssignmentModeChange,
  onSelectedAgentIdsChange,
  onNameChange,
  onProjectPathChange,
  onCoreGoalChange,
  onSave,
  onCancel,
  onStartEdit,
  onDelete,
  onOpenManualPicker,
  onTogglePathSuggestions,
  onPickNativePath,
  onSelectSuggestion,
}: ProjectManagerFormProps) {
  const { t } = useI18n();

  const selectedProject = isCreating ? null : viewedProject;

  return (
    <div className="min-w-0 space-y-3 rounded-xl border border-slate-700 bg-slate-800/50 p-4">
      <label className="block text-xs text-slate-400">
        {t({ ko: '프로젝트 이름', en: 'Project Name' })}
        <input
          type="text"
          value={name}
          onChange={(e) => onNameChange(e.target.value)}
          disabled={!isCreating && !editingProjectId}
          className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white outline-none focus:border-blue-500"
        />
      </label>
      <label className="block text-xs text-slate-400">
        {t({ ko: '프로젝트 경로', en: 'Project Path' })}
        <input
          type="text"
          value={projectPath}
          onChange={(e) => onProjectPathChange(e.target.value)}
          disabled={!isCreating && !editingProjectId}
          className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white outline-none focus:border-blue-500"
        />
      </label>
      {pathToolsVisible && (
        <div className="space-y-2">
          <div className="flex justify-end gap-2">
            <button
              type="button"
              disabled={pathApiUnsupported}
              onClick={onOpenManualPicker}
              className="rounded-md border border-slate-600 px-2.5 py-1 text-xs font-semibold text-slate-200 transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {t({ ko: '앱 내 폴더 탐색', en: 'In-App Folder Browser' })}
            </button>
            <button
              type="button"
              disabled={pathApiUnsupported}
              onClick={onTogglePathSuggestions}
              className="rounded-md border border-slate-600 px-2.5 py-1 text-xs font-semibold text-slate-200 transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {pathSuggestionsOpen
                ? t({ ko: '자동 경로찾기 닫기', en: 'Close Auto Finder' })
                : t({ ko: '자동 경로찾기', en: 'Auto Path Finder' })}
            </button>
            <button
              type="button"
              disabled={nativePathPicking || nativePickerUnsupported}
              onClick={onPickNativePath}
              className="rounded-md border border-slate-600 px-2.5 py-1 text-xs font-semibold text-slate-200 transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-40"
            >
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
                <p className="px-3 py-2 text-xs text-slate-400">
                  {t({ ko: '경로 후보를 불러오는 중...', en: 'Loading path suggestions...' })}
                </p>
              ) : pathSuggestions.length === 0 ? (
                <p className="px-3 py-2 text-xs text-slate-400">
                  {t({ ko: '추천 경로가 없습니다. 직접 입력해주세요.', en: 'No suggested path. Enter one manually.' })}
                </p>
              ) : (
                pathSuggestions.map((candidate) => (
                  <button
                    key={candidate}
                    type="button"
                    onClick={() => onSelectSuggestion(candidate)}
                    className="w-full px-3 py-2 text-left text-xs text-slate-200 transition hover:bg-slate-700/70"
                  >
                    {candidate}
                  </button>
                ))
              )}
            </div>
          )}
          {missingPathPrompt && (
            <p className="text-xs text-amber-300">
              {t({
                ko: '해당 경로가 아직 존재하지 않습니다. 저장 시 생성 여부를 확인합니다.',
                en: 'This path does not exist yet. Save will ask whether to create it.',
})}
            </p>
          )}
        </div>
      )}
      {formFeedback && (
        <div
          className={`rounded-lg border px-3 py-2 text-xs ${
            formFeedback.tone === 'error'
              ? 'border-rose-500/60 bg-rose-500/10 text-rose-800 dark:text-rose-200'
              : 'border-cyan-500/50 bg-cyan-500/10 text-cyan-800 dark:text-cyan-100'
          }`}
        >
          {formFeedback.message}
        </div>
      )}
      <label className="block text-xs text-slate-400">
        {t({ ko: '핵심 목표', en: 'Core Goal' })}
        <textarea
          rows={5}
          value={coreGoal}
          onChange={(e) => onCoreGoalChange(e.target.value)}
          disabled={!isCreating && !editingProjectId}
          className="mt-1 w-full resize-none rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white outline-none focus:border-blue-500"
        />
      </label>

      {/* Assignment Mode */}
      {(isCreating || !!editingProjectId) && (
        <div className="space-y-2">
          <label className="block text-xs text-slate-400">
            {t({ ko: '에이전트 배정 방식', en: 'Assignment Mode' })}
          </label>
          <div className="flex gap-2">
            <button type="button" onClick={() => onAssignmentModeChange('auto')}
              className={`rounded-lg px-3 py-1.5 text-xs font-medium border transition-all ${assignmentMode === 'auto' ? 'border-blue-500/50 bg-blue-500/20 text-blue-300' : 'border-slate-700 text-slate-400 hover:bg-slate-800'}`}>
              {t({ ko: '자동', en: 'Auto' })}
            </button>
            <button type="button" onClick={() => onAssignmentModeChange('manual')}
              className={`rounded-lg px-3 py-1.5 text-xs font-medium border transition-all ${assignmentMode === 'manual' ? 'border-amber-500/50 bg-amber-500/20 text-amber-300' : 'border-slate-700 text-slate-400 hover:bg-slate-800'}`}>
              {t({ ko: '수동 지정', en: 'Manual' })}
            </button>
          </div>
          {assignmentMode === 'manual' && agents.length > 0 && (() => {
            const leaders = agents.filter(a => a.role === 'team_leader' && selectedAgentIds.includes(a.id));
            const subordinates = agents.filter(a => a.role !== 'team_leader' && selectedAgentIds.includes(a.id));
            return (
              <div className="space-y-2">
                <div className="flex items-center gap-3 text-[10px] text-slate-400">
                  <span>{t({ ko: '선택', en: 'Selected' })}: <strong className="text-white">{selectedAgentIds.length}</strong></span>
                  <span>{t({ ko: '팀장', en: 'Leaders' })}: <strong className="text-amber-300">{leaders.length}</strong></span>
                  <span>{t({ ko: '실무자', en: 'Workers' })}: <strong className="text-emerald-300">{subordinates.length}</strong></span>
                </div>
                <div className="max-h-40 overflow-y-auto rounded-lg border border-slate-700 bg-slate-900/60 p-2 space-y-1">
                  {agents.map(agent => {
                    const checked = selectedAgentIds.includes(agent.id);
                    return (
                      <label key={agent.id} className={`flex items-center gap-2 rounded-md px-2 py-1.5 text-xs cursor-pointer transition ${checked ? 'bg-blue-500/10 border border-blue-500/30' : 'hover:bg-slate-800 border border-transparent'}`}>
                        <input type="checkbox" checked={checked}
                          onChange={() => onSelectedAgentIdsChange(checked ? selectedAgentIds.filter(id => id !== agent.id) : [...selectedAgentIds, agent.id])}
                          className="rounded border-slate-600" />
                        <span className="inline-flex items-center justify-center w-5 h-5 text-slate-200">
                          <Icon icon={AVATAR_ICONS[(agent.avatar_emoji && agent.avatar_emoji in AVATAR_ICONS ? agent.avatar_emoji : "bot")]} size="sm" />
                        </span>
                        <span className="text-slate-200">{agent.name}</span>
                        <span className={`text-[10px] ${agent.role === 'team_leader' ? 'text-amber-400' : 'text-slate-500'}`}>
                          {agent.role === 'team_leader' ? 'Leader' : agent.role}
                        </span>
                      </label>
                    );
                  })}
                </div>
                {selectedAgentIds.length > 0 && subordinates.length === 0 && (
                  <p className="text-[10px] text-amber-400">
                    {t({ ko: '실무자가 선택되지 않았습니다. 팀장만으로는 업무 위임이 제한됩니다.', en: 'No workers selected. Delegation will be limited with leaders only.' })}
                  </p>
                )}
              </div>
            );
          })()}
        </div>
      )}

      <div className="flex flex-wrap gap-2 pt-1">
        {(isCreating || !!editingProjectId) && (
          <button
            type="button"
            onClick={onSave}
            disabled={!canSave || saving}
            className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-500 disabled:opacity-40"
          >
            {editingProjectId
              ? t({ ko: '수정 저장', en: 'Save' })
              : t({ ko: '프로젝트 등록', en: 'Create' })}
          </button>
        )}
        {(isCreating || !!editingProjectId) && (
          <button
            type="button"
            onClick={onCancel}
            className="rounded-lg border border-slate-700 px-3 py-1.5 text-xs text-slate-300"
          >
            {t({ ko: '취소', en: 'Cancel' })}
          </button>
        )}
        <button
          type="button"
          onClick={onStartEdit}
          disabled={!selectedProject || isCreating || !!editingProjectId}
          className="rounded-lg border border-slate-700 px-3 py-1.5 text-xs text-slate-300 disabled:opacity-40"
        >
          {t({ ko: '선택 프로젝트 편집', en: 'Edit Selected' })}
        </button>
        <button
          type="button"
          onClick={onDelete}
          disabled={!selectedProject}
          className="rounded-lg border border-red-700/70 px-3 py-1.5 text-xs text-red-300 disabled:opacity-40"
        >
          {t({ ko: '삭제', en: 'Delete' })}
        </button>
      </div>
    </div>
  );
}
