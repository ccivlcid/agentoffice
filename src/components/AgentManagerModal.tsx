import { useState, useEffect, useCallback, useRef } from 'react';
import type { Agent, Department } from '../types';
import { useI18n } from '../i18n';
import * as api from '../api';
import { useModalFocus } from '../hooks/useModalFocus';
import { X, Users, Building2, Plus, Pencil, Trash2, ChevronUp, ChevronDown } from 'lucide-react';
import AgentFormModal from './AgentManagerAgentForm';
import DeptFormModal from './AgentManagerDeptForm';

type Tab = 'agents' | 'departments';

interface Props {
  agents: Agent[];
  departments: Department[];
  onClose: () => void;
  onRefresh: () => void;
  /** 휴게실에서 고용 시 true로 열면 Agents 탭 + 새 에이전트 폼(미배정) 자동 오픈 */
  initialOpenHireFromBreakRoom?: boolean;
  onConsumedInitialHire?: () => void;
}

function OfficeCharacterDisplay({ spriteNumber }: { spriteNumber: number | string | null | undefined }) {
  const n = Math.min(13, Math.max(1, Number(spriteNumber) || 1));
  return (
    <img
      src={`/sprites/${n}-D-1.png`}
      alt=""
      className="h-full w-full object-cover object-bottom shrink-0"
      style={{ imageRendering: 'pixelated' }}
      aria-hidden
    />
  );
}

// ---- Main Agent Manager Modal ----
export default function AgentManagerModal({
  agents, departments, onClose, onRefresh,
  initialOpenHireFromBreakRoom, onConsumedInitialHire,
}: Props) {
  const { t } = useI18n();
  const contentRef = useRef<HTMLDivElement>(null);
  useModalFocus(true, contentRef);
  const [tab, setTab] = useState<Tab>('agents');
  const [agentForm, setAgentForm] = useState<Partial<Agent> | null>(null);
  const [deptForm, setDeptForm] = useState<Partial<Department> | null>(null);
  const [deptList, setDeptList] = useState<Department[]>(departments);
  const [error, setError] = useState('');

  useEffect(() => { setDeptList(departments); }, [departments]);

  useEffect(() => {
    if (initialOpenHireFromBreakRoom) {
      setTab('agents');
      setAgentForm({ department_id: '' });
      onConsumedInitialHire?.();
    }
  }, [initialOpenHireFromBreakRoom, onConsumedInitialHire]);

  // ---- Agent handlers ----
  const handleAgentSave = useCallback(async (data: Record<string, unknown>) => {
    try {
      if (agentForm?.id) {
        await api.updateAgent(agentForm.id, data as any);
      } else {
        await api.createAgent(data as any);
      }
      setAgentForm(null);
      onRefresh();
    } catch (e: any) { setError(e?.message ?? 'Error'); }
  }, [agentForm, onRefresh]);

  const handleAgentDelete = useCallback(async (id: string) => {
    if (!confirm(t({ ko: '이 에이전트를 삭제하시겠습니까?', en: 'Delete this agent?' }))) return;
    try {
      await api.deleteAgent(id);
      onRefresh();
    } catch (e: any) { setError(e?.message ?? 'Error'); }
  }, [onRefresh, t]);

  // ---- Department handlers ----
  const handleDeptSave = useCallback(async (data: Record<string, unknown>) => {
    try {
      if (deptForm?.id && deptForm?.name) {
        await api.updateDepartment(deptForm.id, data as any);
      } else {
        await api.createDepartment(data as any);
      }
      setDeptForm(null);
      onRefresh();
    } catch (e: any) { setError(e?.message ?? 'Error'); }
  }, [deptForm, onRefresh]);

  const handleDeptDelete = useCallback(async (id: string) => {
    if (!confirm(t({ ko: '이 부서를 삭제하시겠습니까?', en: 'Delete this department?' }))) return;
    try {
      await api.deleteDepartment(id);
      onRefresh();
    } catch (e: any) { setError(e?.message ?? 'Error'); }
  }, [onRefresh, t]);

  const handleDeptReorder = useCallback(async (idx: number, dir: -1 | 1) => {
    const copy = [...deptList];
    const target = idx + dir;
    if (target < 0 || target >= copy.length) return;
    [copy[idx], copy[target]] = [copy[target], copy[idx]];
    setDeptList(copy);
    try { await api.reorderDepartments(copy.map(d => d.id)); onRefresh(); } catch (e: any) { setError(e?.message ?? 'Error'); }
  }, [deptList, onRefresh]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={e => e.target === e.currentTarget && onClose()}>
      <div ref={contentRef} className="flex h-[82vh] max-h-[720px] w-[min(920px,94vw)] flex-col overflow-hidden rounded-2xl shadow-2xl transition-shadow" style={{ background: 'var(--th-bg-sidebar)', border: '1px solid var(--th-border)' }}>
        {/* Header */}
        <div className="flex shrink-0 items-center gap-4 px-5 py-4" style={{ borderBottom: '1px solid var(--th-border)' }}>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl" style={{ background: 'var(--th-bg-surface)', border: '1px solid var(--th-border)' }}>
              <Users size={20} style={{ color: 'var(--th-text-accent)' }} aria-hidden />
            </div>
            <div>
              <h2 className="text-base font-semibold" style={{ color: 'var(--th-text-heading)' }}>{t({ ko: '에이전트 매니저', en: 'Agent Manager' })}</h2>
              <p className="text-[11px] mt-0.5" style={{ color: 'var(--th-text-muted)' }}>{t({ ko: '에이전트와 부서를 관리합니다', en: 'Manage agents and departments' })}</p>
            </div>
          </div>
          <nav className="flex rounded-xl p-1" style={{ background: 'var(--th-bg-surface)', border: '1px solid var(--th-border)' }} aria-label={t({ ko: '탭', en: 'Tabs' })}>
            <button
              onClick={() => setTab('agents')}
              className="flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors"
              style={tab === 'agents' ? { background: 'var(--th-focus-ring)', color: 'var(--th-text-primary)' } : { color: 'var(--th-text-muted)' }}
            >
              <Users size={16} aria-hidden />
              {t({ ko: '에이전트', en: 'Agents' })}
              <span className="rounded-full px-2 py-0.5 text-[10px] font-medium" style={{ background: tab === 'agents' ? 'var(--th-bg-sidebar)' : 'transparent', color: 'var(--th-text-muted)' }}>{agents.length}</span>
            </button>
            <button
              onClick={() => setTab('departments')}
              className="flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors"
              style={tab === 'departments' ? { background: 'var(--th-focus-ring)', color: 'var(--th-text-primary)' } : { color: 'var(--th-text-muted)' }}
            >
              <Building2 size={16} aria-hidden />
              {t({ ko: '부서', en: 'Departments' })}
              <span className="rounded-full px-2 py-0.5 text-[10px] font-medium" style={{ background: tab === 'departments' ? 'var(--th-bg-sidebar)' : 'transparent', color: 'var(--th-text-muted)' }}>{deptList.length}</span>
            </button>
          </nav>
          <div className="flex-1" />
          <button onClick={onClose} className="rounded-lg p-2 transition-colors hover:opacity-80" style={{ color: 'var(--th-text-muted)' }} aria-label={t({ ko: '닫기', en: 'Close' })}><X size={20} aria-hidden /></button>
        </div>

        {error && (
          <div className="shrink-0 flex items-center justify-between px-4 py-2.5 text-sm" style={{ background: 'var(--th-bg-surface)', borderBottom: '1px solid var(--th-border)', color: 'var(--th-text-secondary)' }}>
            <span>{error}</span>
            <button onClick={() => setError('')} className="text-[11px] font-medium underline" style={{ color: 'var(--th-text-accent)' }}>{t({ ko: '닫기', en: 'Dismiss' })}</button>
          </div>
        )}

        {/* Agents Tab */}
        {tab === 'agents' && (
          <div className="flex flex-1 flex-col overflow-hidden">
            <div className="flex shrink-0 items-center justify-between px-5 py-3" style={{ borderBottom: '1px solid var(--th-border)' }}>
              <p className="text-sm font-medium" style={{ color: 'var(--th-text-secondary)' }}>
                {t({ ko: '등록된 에이전트', en: 'Registered agents' })} <span className="font-normal" style={{ color: 'var(--th-text-muted)' }}>({agents.length})</span>
              </p>
              <button
                onClick={() => setAgentForm({})}
                className="flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium text-white shadow-sm transition-opacity hover:opacity-90"
                style={{ background: 'var(--th-text-accent)' }}
              >
                <Plus size={16} aria-hidden />
                {t({ ko: '에이전트 채용', en: 'Hire Agent' })}
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4">
              {agents.length === 0 ? (
                <div className="flex flex-col items-center justify-center rounded-xl py-16 text-center" style={{ background: 'var(--th-bg-surface)', border: '1px dashed var(--th-border)' }}>
                  <Users size={40} className="mb-3 opacity-50" style={{ color: 'var(--th-text-muted)' }} aria-hidden />
                  <p className="text-sm font-medium" style={{ color: 'var(--th-text-secondary)' }}>{t({ ko: '등록된 에이전트가 없습니다', en: 'No agents yet' })}</p>
                  <p className="mt-1 text-xs max-w-[280px]" style={{ color: 'var(--th-text-muted)' }}>{t({ ko: '에이전트를 채용하면 오피스에서 업무를 할당하고 협업할 수 있습니다.', en: 'Hire agents to assign tasks and collaborate in the office.' })}</p>
                  <button onClick={() => setAgentForm({})} className="mt-4 flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium text-white" style={{ background: 'var(--th-text-accent)' }}><Plus size={16} />{t({ ko: '첫 에이전트 채용', en: 'Hire first agent' })}</button>
                </div>
              ) : (
                <ul className="space-y-3">
                  {agents.map(a => {
                    const dept = departments.find(d => d.id === a.department_id);
                    return (
                      <li key={a.id}>
                        <div
                          className="flex items-center gap-4 rounded-xl px-4 py-3 transition-colors hover:bg-[var(--th-bg-surface-hover)]"
                          style={{ background: 'var(--th-bg-surface)', border: '1px solid var(--th-border)' }}
                        >
                          <div className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-lg" style={{ background: 'var(--th-bg-sidebar)', border: '1px solid var(--th-border)' }}>
                            <OfficeCharacterDisplay spriteNumber={a.sprite_number} />
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-medium" style={{ color: 'var(--th-text-heading)' }}>{a.name} <span className="font-normal" style={{ color: 'var(--th-text-muted)' }}>({a.name_ko})</span></p>
                            <p className="mt-0.5 flex items-center gap-2 text-[11px]" style={{ color: 'var(--th-text-muted)' }}>
                              <span>{a.role}</span>
                              <span aria-hidden>·</span>
                              <span>{a.cli_provider}</span>
                              {dept && <><span aria-hidden>·</span><span>{dept.name_ko ?? dept.name}</span></>}
                            </p>
                          </div>
                          <span
                            className="shrink-0 rounded-full px-2.5 py-1 text-[11px] font-medium"
                            style={a.status === 'working' ? { background: 'rgba(34,197,94,0.2)', color: 'rgb(134,239,172)' } : a.status === 'idle' ? { background: 'var(--th-bg-sidebar)', color: 'var(--th-text-muted)' } : { background: 'rgba(234,179,8,0.2)', color: 'rgb(253,224,71)' }}
                          >
                            {a.status}
                          </span>
                          <div className="flex shrink-0 items-center gap-1">
                            <button onClick={() => setAgentForm(a)} className="rounded-lg p-2 transition-colors hover:opacity-80" style={{ color: 'var(--th-text-muted)' }} title={t({ ko: '편집', en: 'Edit' })} aria-label={t({ ko: '편집', en: 'Edit' })}><Pencil size={16} /></button>
                            <button onClick={() => handleAgentDelete(a.id)} disabled={a.status === 'working'} className="rounded-lg p-2 transition-colors hover:opacity-80 disabled:opacity-30" style={{ color: 'var(--th-text-muted)' }} title={t({ ko: '삭제', en: 'Delete' })} aria-label={t({ ko: '삭제', en: 'Delete' })}><Trash2 size={16} /></button>
                          </div>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </div>
        )}

        {/* Departments Tab */}
        {tab === 'departments' && (
          <div className="flex flex-1 flex-col overflow-hidden">
            <div className="flex shrink-0 items-center justify-between px-5 py-3" style={{ borderBottom: '1px solid var(--th-border)' }}>
              <p className="text-sm font-medium" style={{ color: 'var(--th-text-secondary)' }}>
                {t({ ko: '부서 목록', en: 'Departments' })} <span className="font-normal" style={{ color: 'var(--th-text-muted)' }}>({deptList.length})</span>
              </p>
              <button
                onClick={() => setDeptForm({})}
                className="flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium text-white shadow-sm transition-opacity hover:opacity-90"
                style={{ background: 'var(--th-text-accent)' }}
              >
                <Plus size={16} aria-hidden />
                {t({ ko: '부서 추가', en: 'Add Department' })}
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4">
              {deptList.length === 0 ? (
                <div className="flex flex-col items-center justify-center rounded-xl py-16 text-center" style={{ background: 'var(--th-bg-surface)', border: '1px dashed var(--th-border)' }}>
                  <Building2 size={40} className="mb-3 opacity-50" style={{ color: 'var(--th-text-muted)' }} aria-hidden />
                  <p className="text-sm font-medium" style={{ color: 'var(--th-text-secondary)' }}>{t({ ko: '등록된 부서가 없습니다', en: 'No departments yet' })}</p>
                  <p className="mt-1 text-xs max-w-[280px]" style={{ color: 'var(--th-text-muted)' }}>{t({ ko: '부서를 만들면 에이전트를 배치하고 역할을 구분할 수 있습니다.', en: 'Create departments to organize agents and roles.' })}</p>
                  <button onClick={() => setDeptForm({})} className="mt-4 flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium text-white" style={{ background: 'var(--th-text-accent)' }}><Plus size={16} />{t({ ko: '첫 부서 만들기', en: 'Create first department' })}</button>
                </div>
              ) : (
                <ul className="space-y-3">
                  {deptList.map((d, idx) => (
                    <li key={d.id}>
                      <div
                        className="flex items-center gap-4 rounded-xl px-4 py-3 transition-colors hover:bg-[var(--th-bg-surface-hover)]"
                        style={{ background: 'var(--th-bg-surface)', border: '1px solid var(--th-border)' }}
                      >
                        <div className="flex shrink-0 flex-col gap-0.5">
                          <button disabled={idx === 0} onClick={() => handleDeptReorder(idx, -1)} className="rounded p-1 transition-colors disabled:opacity-20" style={{ color: 'var(--th-text-muted)' }} aria-label={t({ ko: '위로', en: 'Move up' })}><ChevronUp size={18} /></button>
                          <button disabled={idx === deptList.length - 1} onClick={() => handleDeptReorder(idx, 1)} className="rounded p-1 transition-colors disabled:opacity-20" style={{ color: 'var(--th-text-muted)' }} aria-label={t({ ko: '아래로', en: 'Move down' })}><ChevronDown size={18} /></button>
                        </div>
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-lg" style={{ background: 'var(--th-bg-sidebar)', border: '1px solid var(--th-border)' }}>{d.icon}</div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium" style={{ color: 'var(--th-text-heading)' }}>{d.name} <span className="font-normal" style={{ color: 'var(--th-text-muted)' }}>({d.name_ko})</span></p>
                          <p className="mt-0.5 text-[11px]" style={{ color: 'var(--th-text-muted)' }}>{d.id} · {d.agent_count ?? 0} {t({ ko: '명', en: 'agents' })} {d.description ? `· ${d.description}` : ''}</p>
                        </div>
                        <span className="h-4 w-4 shrink-0 rounded-full" style={{ backgroundColor: d.color || 'var(--th-text-muted)' }} aria-hidden />
                        <div className="flex shrink-0 items-center gap-1">
                          <button onClick={() => setDeptForm(d)} className="rounded-lg p-2 transition-colors hover:opacity-80" style={{ color: 'var(--th-text-muted)' }} title={t({ ko: '편집', en: 'Edit' })} aria-label={t({ ko: '편집', en: 'Edit' })}><Pencil size={16} /></button>
                          <button onClick={() => handleDeptDelete(d.id)} className="rounded-lg p-2 transition-colors hover:opacity-80" style={{ color: 'var(--th-text-muted)' }} title={t({ ko: '삭제', en: 'Delete' })} aria-label={t({ ko: '삭제', en: 'Delete' })}><Trash2 size={16} /></button>
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        )}
      </div>

      {agentForm !== null && <AgentFormModal agent={agentForm} departments={departments} onSave={handleAgentSave} onCancel={() => setAgentForm(null)} />}
      {deptForm !== null && <DeptFormModal dept={deptForm} onSave={handleDeptSave} onCancel={() => setDeptForm(null)} />}
    </div>
  );
}
