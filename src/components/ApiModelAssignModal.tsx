/**
 * Modal for assigning an API model to an agent.
 */
import AgentAvatar, { buildSpriteMap } from './AgentAvatar';
import { useSettingsPanel } from './SettingsPanelContext';

export function ApiModelAssignModal() {
  const {
    t,
    localeTag,
    apiProviders,
    apiAssignTarget,
    setApiAssignTarget,
    apiAssignAgents,
    apiAssignDepts,
    apiAssigning,
    handleApiAssignToAgent,
  } = useSettingsPanel();

  if (!apiAssignTarget) return null;

  const spriteMap = buildSpriteMap(apiAssignAgents);
  const agentsByDept = apiAssignDepts.map((dept) => ({
    dept,
    agents: apiAssignAgents.filter((a) => a.department_id === dept.id),
  }));

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      role="dialog"
      aria-modal="true"
      aria-label={t({ ko: '에이전트에 API 모델 할당', en: 'Assign API model to agent' })}
    >
      <div className="bg-slate-800 border border-slate-700 rounded-xl shadow-xl max-w-lg w-full max-h-[80vh] overflow-hidden flex flex-col">
        <div className="flex items-center justify-between p-4 border-b border-slate-700">
          <h4 className="text-sm font-semibold text-slate-200">
            {t({ ko: '에이전트 선택', en: 'Select agent' })}
          </h4>
          <button
            onClick={() => setApiAssignTarget(null)}
            className="text-slate-400 hover:text-white p-1 rounded"
          >
            ×
          </button>
        </div>
        <div className="overflow-y-auto p-4 space-y-4">
          {agentsByDept.map(({ dept, agents }) =>
            agents.length === 0 ? null : (
              <div key={dept.id}>
                <h5 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
                  {localeTag.startsWith('ko') ? dept.name_ko : dept.name}
                </h5>
                <ul className="space-y-2">
                  {agents.map((agent) => {
                    const displayName = localeTag.startsWith('ko') ? agent.name_ko : agent.name;
                    const roleLabel =
                      agent.role === 'team_leader'
                        ? t({ ko: '팀장', en: 'Team leader' })
                        : agent.role === 'senior'
                          ? t({ ko: '시니어', en: 'Senior' })
                          : agent.role === 'junior'
                            ? t({ ko: '주니어', en: 'Junior' })
                            : t({ ko: '인턴', en: 'Intern' });
                    const currentProvider = apiProviders.find((p) => p.id === agent.api_provider_id);
                    const apiInfo =
                      agent.cli_provider === 'api' && agent.api_provider_id && agent.api_model
                        ? `${currentProvider?.name ?? agent.api_provider_id} / ${agent.api_model}`
                        : t({ ko: '미할당', en: 'Not assigned' });
                    return (
                      <li key={agent.id}>
                        <button
                          type="button"
                          onClick={() => handleApiAssignToAgent(agent.id)}
                          disabled={apiAssigning}
                          className="w-full flex items-center gap-3 rounded-lg p-2 text-left bg-slate-700/50 hover:bg-slate-700 border border-transparent hover:border-slate-600 disabled:opacity-50"
                        >
                          <AgentAvatar agent={agent} spriteMap={spriteMap} size={32} />
                          <div className="flex-1 min-w-0">
                            <div className="text-sm text-slate-200 truncate">{displayName}</div>
                            <div className="flex items-center gap-2 text-xs text-slate-500">
                              <span className="shrink-0">{roleLabel}</span>
                              <span className="truncate font-mono">{apiInfo}</span>
                            </div>
                          </div>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </div>
            )
          )}
        </div>
      </div>
    </div>
  );
}
