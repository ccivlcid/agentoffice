import { useState, useCallback } from 'react';
import type { Agent } from '../types';
import { useI18n } from '../i18n';
import TaskReportPopup from './TaskReportPopup';
import GitHubImportPanel from './GitHubImportPanel';
import ProjectManagerList from './project-manager/ProjectManagerList';
import ProjectManagerForm from './project-manager/ProjectManagerForm';
import ProjectManagerDetail from './project-manager/ProjectManagerDetail';
import { MissingPathDialog, ManualPathPicker } from './project-manager/ProjectManagerPathPicker';
import { useProjectManagerLogic } from './project-manager/useProjectManagerLogic';

interface ProjectManagerModalProps {
  agents: Agent[];
  onClose: () => void;
}

export default function ProjectManagerModal({ agents, onClose }: ProjectManagerModalProps) {
  const { t, language } = useI18n();
  const [mobileShowDetail, setMobileShowDetail] = useState(false);
  const logic = useProjectManagerLogic();

  const formTitle = logic.editingProjectId
    ? t({ ko: '프로젝트 수정', en: 'Edit Project' })
    : logic.isCreating
      ? t({ ko: '신규 프로젝트 등록', en: 'Register New Project' })
      : t({ ko: '프로젝트 정보', en: 'Project Info' });

  if (logic.reportDetail) {
    return (
      <TaskReportPopup
        report={logic.reportDetail}
        agents={agents}
        uiLanguage={language}
        onClose={() => logic.setReportDetail(null)}
      />
    );
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="flex h-[86vh] w-[min(1180px,95vw)] overflow-hidden rounded-2xl border border-slate-700 bg-slate-900 shadow-2xl">
        {/* Mobile: hide list when detail is shown */}
        <div className={`${mobileShowDetail ? 'hidden md:flex' : 'flex'} min-w-0 md:flex`}>
          <ProjectManagerList
            projects={logic.projects}
            page={logic.page}
            totalPages={logic.totalPages}
            search={logic.search}
            loadingList={logic.loadingList}
            selectedProjectId={logic.selectedProjectId}
            onSearchChange={logic.setSearch}
            onSearch={() => void logic.loadProjects(1, logic.search)}
            onPageChange={(newPage) => void logic.loadProjects(newPage, logic.search)}
            onSelectProject={(id) => {
              logic.setSelectedProjectId(id);
              logic.setIsCreating(false);
              logic.setEditingProjectId(null);
              setMobileShowDetail(true);
            }}
            onNewProject={() => {
              logic.startCreate();
              setMobileShowDetail(true);
            }}
            onGithubImport={() => {
              logic.setGithubImportMode(true);
              logic.setIsCreating(false);
              logic.setEditingProjectId(null);
              setMobileShowDetail(true);
            }}
            onClose={onClose}
          />
        </div>

        {/* Mobile: hide detail when list is shown; always show on desktop */}
        <section className={`${mobileShowDetail ? 'flex' : 'hidden md:flex'} min-w-0 flex-1 flex-col overflow-hidden`}>
          {logic.githubImportMode ? (
            <GitHubImportPanel
              onComplete={(result) => {
                logic.setGithubImportMode(false);
                void logic.loadProjects(1, '');
                logic.setSelectedProjectId(result.projectId);
                logic.setIsCreating(false);
                logic.setEditingProjectId(null);
              }}
              onCancel={() => logic.setGithubImportMode(false)}
            />
          ) : (
            <>
              <div className="flex items-center gap-2 border-b border-slate-700 px-5 py-3">
                <button
                  type="button"
                  className="rounded p-1 text-slate-400 hover:text-white md:hidden"
                  onClick={() => {
                    setMobileShowDetail(false);
                    logic.setSelectedProjectId(null);
                    logic.setIsCreating(false);
                    logic.setEditingProjectId(null);
                  }}
                >
                  ← {t({ ko: '목록', en: 'List' })}
                </button>
                <h3 className="text-sm font-semibold text-white">{formTitle}</h3>
              </div>
              <div className="grid min-w-0 flex-1 grid-cols-1 gap-4 overflow-y-auto overflow-x-hidden p-5 xl:grid-cols-[minmax(0,360px)_minmax(0,1fr)]">
                <ProjectManagerForm
                  isCreating={logic.isCreating}
                  editingProjectId={logic.editingProjectId}
                  viewedProject={logic.viewedProject}
                  name={logic.name}
                  projectPath={logic.projectPath}
                  coreGoal={logic.coreGoal}
                  canSave={logic.canSave}
                  saving={logic.saving}
                  pathToolsVisible={logic.pathToolsVisible}
                  pathApiUnsupported={logic.pathApiUnsupported}
                  nativePathPicking={logic.nativePathPicking}
                  nativePickerUnsupported={logic.nativePickerUnsupported}
                  pathSuggestionsOpen={logic.pathSuggestionsOpen}
                  pathSuggestionsLoading={logic.pathSuggestionsLoading}
                  pathSuggestions={logic.pathSuggestions}
                  missingPathPrompt={logic.missingPathPrompt}
                  formFeedback={logic.formFeedback}
                  agents={agents}
                  assignmentMode={logic.assignmentMode}
                  selectedAgentIds={logic.selectedAgentIds}
                  onAssignmentModeChange={logic.setAssignmentMode}
                  onSelectedAgentIdsChange={logic.setSelectedAgentIds}
                  onNameChange={logic.setName}
                  onProjectPathChange={logic.setProjectPath}
                  onCoreGoalChange={logic.setCoreGoal}
                  onSave={() => void logic.handleSave()}
                  onCancel={() => {
                    logic.setIsCreating(false);
                    logic.setEditingProjectId(null);
                    logic.resetPathHelperState();
                    if (logic.viewedProject) {
                      logic.setName(logic.viewedProject.name);
                      logic.setProjectPath(logic.viewedProject.project_path);
                      logic.setCoreGoal(logic.viewedProject.core_goal);
                    }
                  }}
                  onStartEdit={logic.startEditSelected}
                  onDelete={() => void logic.handleDelete()}
                  onOpenManualPicker={() => {
                    logic.setManualPathPickerOpen(true);
                    void logic.loadManualPathEntries(logic.projectPath.trim() || undefined);
                  }}
                  onTogglePathSuggestions={() => logic.setPathSuggestionsOpen((prev) => !prev)}
                  onPickNativePath={() => void logic.handleNativePathPick()}
                  onSelectSuggestion={(candidate) => {
                    logic.setProjectPath(candidate);
                    logic.setMissingPathPrompt(null);
                    logic.setPathSuggestionsOpen(false);
                  }}
                />
                <ProjectManagerDetail
                  selectedProject={logic.selectedProject}
                  isCreating={logic.isCreating}
                  loadingDetail={logic.loadingDetail}
                  detail={logic.detail}
                  onOpenTaskDetail={(taskId) => void logic.handleOpenTaskDetail(taskId)}
                />
              </div>
            </>
          )}
        </section>
      </div>

      {logic.missingPathPrompt && (
        <MissingPathDialog
          missingPathPrompt={logic.missingPathPrompt}
          saving={logic.saving}
          onCancel={() => logic.setMissingPathPrompt(null)}
          onConfirm={() => { logic.setMissingPathPrompt(null); void logic.handleSave(true); }}
        />
      )}

      {logic.manualPathPickerOpen && (
        <ManualPathPicker
          manualPathCurrent={logic.manualPathCurrent}
          manualPathParent={logic.manualPathParent}
          manualPathEntries={logic.manualPathEntries}
          manualPathTruncated={logic.manualPathTruncated}
          manualPathLoading={logic.manualPathLoading}
          manualPathError={logic.manualPathError}
          onClose={() => logic.setManualPathPickerOpen(false)}
          onNavigate={(path) => void logic.loadManualPathEntries(path)}
          onSelectCurrent={() => {
            if (!logic.manualPathCurrent) return;
            logic.setProjectPath(logic.manualPathCurrent);
            logic.setMissingPathPrompt(null);
            logic.setPathSuggestionsOpen(false);
            logic.setManualPathPickerOpen(false);
          }}
        />
      )}
    </div>
  );
}
