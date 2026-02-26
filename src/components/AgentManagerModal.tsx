import { useState, useEffect, useCallback } from 'react';
import type { Agent, Department } from '../types';
import { useI18n } from '../i18n';
import * as api from '../api';
import { AVATAR_ICONS } from '../constants/icons';
import { X } from 'lucide-react';

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

const AVATAR_ICON_KEYS = Object.keys(AVATAR_ICONS) as string[];


function AvatarIconPicker({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [open, setOpen] = useState(false);
  const IconComp = value && value in AVATAR_ICONS ? AVATAR_ICONS[value] : AVATAR_ICONS.bot;
  return (
    <div className="relative">
      <button type="button" onClick={() => setOpen(!open)} className="flex items-center justify-center rounded border border-slate-600 bg-slate-800 px-3 py-1.5 h-8 w-8 text-slate-300 hover:bg-slate-700">
        <IconComp width={18} height={18} aria-hidden />
      </button>
      {open && (
        <div className="absolute left-0 top-full z-50 mt-1 max-h-48 w-72 overflow-y-auto rounded border border-slate-600 bg-slate-800 p-2 shadow-lg">
          <div className="grid grid-cols-8 gap-1">
            {AVATAR_ICON_KEYS.map((key) => {
              const Icon = AVATAR_ICONS[key];
              return (
                <button key={key} type="button" className="flex items-center justify-center rounded p-1.5 hover:bg-slate-700 text-slate-300 hover:text-white" onClick={() => { onChange(key); setOpen(false); }} title={key}>
                  <Icon width={20} height={20} aria-hidden />
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function AvatarDisplay({ avatarEmoji }: { avatarEmoji: string | null | undefined }) {
  const IconComp = avatarEmoji && avatarEmoji in AVATAR_ICONS ? AVATAR_ICONS[avatarEmoji] : null;
  if (IconComp) return <IconComp width={20} height={20} className="text-slate-300 shrink-0" aria-hidden />;
  if (avatarEmoji) return <span className="text-lg leading-none" aria-hidden>{avatarEmoji}</span>;
  return <AVATAR_ICONS.bot width={20} height={20} className="text-slate-400 shrink-0" aria-hidden />;
}

// ---- Agent Form Modal ----
function AgentFormModal({ agent, departments, onSave, onCancel }: {
  agent: Partial<Agent> | null;
  departments: Department[];
  onSave: (data: Record<string, unknown>) => void;
  onCancel: () => void;
}) {
  const { t } = useI18n();
  const isEdit = !!agent?.id;
  const [name, setName] = useState(agent?.name ?? '');
  const [nameKo, setNameKo] = useState(agent?.name_ko ?? '');
  const [nameJa, setNameJa] = useState(agent?.name_ja ?? '');
  const [nameZh, setNameZh] = useState(agent?.name_zh ?? '');
  const [deptId, setDeptId] = useState<string>(agent?.department_id ?? (departments[0]?.id ?? ''));
  const [role, setRole] = useState<string>(agent?.role ?? 'junior');
  const [cliProvider, setCliProvider] = useState(agent?.cli_provider ?? 'claude');
  const [spriteNum, setSpriteNum] = useState(agent?.sprite_number ?? 1);
  const [emoji, setEmoji] = useState(() =>
    (agent?.avatar_emoji && agent.avatar_emoji in AVATAR_ICONS) ? agent.avatar_emoji : 'bot'
  );
  const [personality, setPersonality] = useState(agent?.personality ?? '');
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!name.trim()) return;
    setSaving(true);
    onSave({
      name: name.trim(), name_ko: nameKo.trim() || name.trim(),
      name_ja: nameJa.trim() || null, name_zh: nameZh.trim() || null,
      department_id: deptId, role, cli_provider: cliProvider,
      sprite_number: spriteNum, avatar_emoji: emoji,
      personality: personality.trim() || null,
    });
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50" onClick={e => e.target === e.currentTarget && onCancel()}>
      <div className="w-[min(480px,90vw)] max-h-[80vh] overflow-y-auto rounded-xl border border-slate-700 bg-slate-900 p-5 shadow-xl">
        <h3 className="mb-4 text-sm font-bold text-white">
          {isEdit ? t({ ko: '에이전트 편집', en: 'Edit Agent' }) : t({ ko: '새 에이전트 채용', en: 'Hire New Agent' })}
        </h3>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <label className="block"><span className="text-xs text-slate-400">{t({ ko: '이름 (EN)', en: 'Name (EN)' })}</span>
              <input className="mt-1 w-full rounded border border-slate-600 bg-slate-800 px-2 py-1.5 text-xs text-white" value={name} onChange={e => setName(e.target.value)} /></label>
            <label className="block"><span className="text-xs text-slate-400">{t({ ko: '이름 (KO)', en: 'Name (KO)' })}</span>
              <input className="mt-1 w-full rounded border border-slate-600 bg-slate-800 px-2 py-1.5 text-xs text-white" value={nameKo} onChange={e => setNameKo(e.target.value)} /></label>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <label className="block"><span className="text-xs text-slate-400">{t({ ko: '부서', en: 'Department' })}</span>
              <select className="mt-1 w-full rounded border border-slate-600 bg-slate-800 px-2 py-1.5 text-xs text-white" value={deptId ?? ''} onChange={e => setDeptId(e.target.value)}>
                <option value="">{t({ ko: '휴게실 (미배정)', en: 'Break room (unassigned)' })}</option>
                {departments.map(d => <option key={d.id} value={d.id}>{d.icon} {d.name}</option>)}
              </select></label>
            <label className="block"><span className="text-xs text-slate-400">{t({ ko: '역할', en: 'Role' })}</span>
              <select className="mt-1 w-full rounded border border-slate-600 bg-slate-800 px-2 py-1.5 text-xs text-white" value={role} onChange={e => setRole(e.target.value)}>
                <option value="team_leader">Team Leader</option>
                <option value="senior">Senior</option>
                <option value="junior">Junior</option>
                <option value="intern">Intern</option>
              </select></label>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <label className="block"><span className="text-xs text-slate-400">{t({ ko: 'CLI', en: 'CLI Provider' })}</span>
              <select className="mt-1 w-full rounded border border-slate-600 bg-slate-800 px-2 py-1.5 text-xs text-white" value={cliProvider} onChange={e => setCliProvider(e.target.value as typeof cliProvider)}>
                {(['claude','codex','gemini','opencode','copilot','antigravity','api'] as const).map(p => <option key={p} value={p}>{p}</option>)}
              </select></label>
            <label className="block"><span className="text-xs text-slate-400">{t({ ko: '캐릭터', en: 'Character' })}</span>
              <div className="mt-1 flex flex-wrap gap-1.5">
                {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13].map((n) => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => setSpriteNum(n)}
                    className={`flex h-9 w-9 items-center justify-center overflow-hidden rounded-md border bg-slate-800 transition-colors ${
                      spriteNum === n
                        ? 'border-amber-500 ring-2 ring-amber-500/50'
                        : 'border-slate-600 hover:border-slate-500'
                    }`}
                    title={t({ ko: `캐릭터 ${n}`, en: `Character ${n}` })}
                    aria-label={t({ ko: `캐릭터 ${n}`, en: `Character ${n}` })}
                  >
                    <img
                      src={`/sprites/${n}-D-1.png`}
                      alt=""
                      className="h-full w-full object-cover object-bottom"
                      style={{ imageRendering: 'pixelated' }}
                    />
                  </button>
                ))}
              </div></label>
            <label className="block"><span className="text-xs text-slate-400">{t({ ko: '아바타', en: 'Avatar' })}</span>
              <div className="mt-1"><AvatarIconPicker value={emoji} onChange={setEmoji} /></div></label>
          </div>
          <label className="block"><span className="text-xs text-slate-400">{t({ ko: '성격', en: 'Personality' })}</span>
            <textarea className="mt-1 w-full rounded border border-slate-600 bg-slate-800 px-2 py-1.5 text-xs text-white" rows={2} value={personality} onChange={e => setPersonality(e.target.value)} /></label>
        </div>
        <div className="mt-4 flex gap-2">
          <button disabled={saving || !name.trim()} onClick={handleSave} className="flex-1 rounded bg-blue-600 py-2 text-xs font-medium text-white hover:bg-blue-500 disabled:opacity-40">
            {saving ? '...' : isEdit ? t({ ko: '저장', en: 'Save' }) : t({ ko: '채용', en: 'Hire' })}
          </button>
          <button onClick={onCancel} className="rounded border border-slate-700 px-4 py-2 text-xs text-slate-300">{t({ ko: '취소', en: 'Cancel' })}</button>
        </div>
      </div>
    </div>
  );
}

// ---- Department Form Modal ----
function DeptFormModal({ dept, onSave, onCancel }: {
  dept: Partial<Department> | null;
  onSave: (data: Record<string, unknown>) => void;
  onCancel: () => void;
}) {
  const { t } = useI18n();
  const isEdit = !!dept?.id && !!dept?.name;
  const [id, setId] = useState(dept?.id ?? '');
  const [name, setName] = useState(dept?.name ?? '');
  const [nameKo, setNameKo] = useState(dept?.name_ko ?? '');
  const [nameJa, setNameJa] = useState(dept?.name_ja ?? '');
  const [nameZh, setNameZh] = useState(dept?.name_zh ?? '');
  const [icon, setIcon] = useState(dept?.icon ?? 'folder');
  const [color, setColor] = useState(dept?.color ?? '#6B7280');
  const [description, setDescription] = useState(dept?.description ?? '');
  const [prompt, setPrompt] = useState(dept?.prompt ?? '');
  const [saving, setSaving] = useState(false);

  const handleSave = () => {
    if (!name.trim() || !nameKo.trim() || (!isEdit && !id.trim())) return;
    setSaving(true);
    onSave({
      ...(isEdit ? {} : { id: id.trim() }),
      name: name.trim(), name_ko: nameKo.trim(),
      name_ja: nameJa.trim() || null, name_zh: nameZh.trim() || null,
      icon, color, description: description.trim() || null, prompt: prompt.trim() || null,
    });
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50" onClick={e => e.target === e.currentTarget && onCancel()}>
      <div className="w-[min(480px,90vw)] max-h-[80vh] overflow-y-auto rounded-xl border border-slate-700 bg-slate-900 p-5 shadow-xl">
        <h3 className="mb-4 text-sm font-bold text-white">
          {isEdit ? t({ ko: '부서 편집', en: 'Edit Department' }) : t({ ko: '새 부서 생성', en: 'Create Department' })}
        </h3>
        <div className="space-y-3">
          {!isEdit && (
            <label className="block"><span className="text-xs text-slate-400">{t({ ko: 'ID (a-z0-9)', en: 'ID (a-z0-9)' })}</span>
              <input className="mt-1 w-full rounded border border-slate-600 bg-slate-800 px-2 py-1.5 text-xs text-white" value={id} onChange={e => setId(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))} /></label>
          )}
          <div className="grid grid-cols-2 gap-3">
            <label className="block"><span className="text-xs text-slate-400">{t({ ko: '이름 (EN)', en: 'Name (EN)' })}</span>
              <input className="mt-1 w-full rounded border border-slate-600 bg-slate-800 px-2 py-1.5 text-xs text-white" value={name} onChange={e => setName(e.target.value)} /></label>
            <label className="block"><span className="text-xs text-slate-400">{t({ ko: '이름 (KO)', en: 'Name (KO)' })}</span>
              <input className="mt-1 w-full rounded border border-slate-600 bg-slate-800 px-2 py-1.5 text-xs text-white" value={nameKo} onChange={e => setNameKo(e.target.value)} /></label>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <label className="block"><span className="text-xs text-slate-400">{t({ ko: '아이콘', en: 'Icon' })}</span>
              <input className="mt-1 w-full rounded border border-slate-600 bg-slate-800 px-2 py-1.5 text-xs text-white" value={icon} onChange={e => setIcon(e.target.value)} /></label>
            <label className="block"><span className="text-xs text-slate-400">{t({ ko: '색상', en: 'Color' })}</span>
              <input type="color" className="mt-1 h-8 w-full cursor-pointer rounded border border-slate-600 bg-slate-800" value={color} onChange={e => setColor(e.target.value)} /></label>
          </div>
          <label className="block"><span className="text-xs text-slate-400">{t({ ko: '설명', en: 'Description' })}</span>
            <textarea className="mt-1 w-full rounded border border-slate-600 bg-slate-800 px-2 py-1.5 text-xs text-white" rows={2} value={description} onChange={e => setDescription(e.target.value)} /></label>
          <label className="block"><span className="text-xs text-slate-400">{t({ ko: '프롬프트', en: 'Prompt' })}</span>
            <textarea className="mt-1 w-full rounded border border-slate-600 bg-slate-800 px-2 py-1.5 text-xs text-white" rows={3} value={prompt} onChange={e => setPrompt(e.target.value)} /></label>
        </div>
        <div className="mt-4 flex gap-2">
          <button disabled={saving || !name.trim() || !nameKo.trim()} onClick={handleSave} className="flex-1 rounded bg-blue-600 py-2 text-xs font-medium text-white hover:bg-blue-500 disabled:opacity-40">
            {saving ? '...' : isEdit ? t({ ko: '저장', en: 'Save' }) : t({ ko: '생성', en: 'Create' })}
          </button>
          <button onClick={onCancel} className="rounded border border-slate-700 px-4 py-2 text-xs text-slate-300">{t({ ko: '취소', en: 'Cancel' })}</button>
        </div>
      </div>
    </div>
  );
}

// ---- Main Agent Manager Modal ----
export default function AgentManagerModal({
  agents, departments, onClose, onRefresh,
  initialOpenHireFromBreakRoom, onConsumedInitialHire,
}: Props) {
  const { t } = useI18n();
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
      <div className="flex h-[80vh] w-[min(900px,95vw)] flex-col overflow-hidden rounded-2xl border border-slate-700 bg-slate-900 shadow-2xl">
        {/* Header + Tabs */}
        <div className="flex items-center gap-4 border-b border-slate-700 px-5 py-3">
          <h2 className="text-sm font-bold text-white">{t({ ko: '에이전트 매니저', en: 'Agent Manager' })}</h2>
          <div className="flex rounded-lg border border-slate-700 text-xs">
            <button onClick={() => setTab('agents')} className={`px-3 py-1.5 ${tab === 'agents' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'}`}>
              {t({ ko: 'Agents', en: 'Agents' })}
            </button>
            <button onClick={() => setTab('departments')} className={`px-3 py-1.5 ${tab === 'departments' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'}`}>
              {t({ ko: 'Departments', en: 'Departments' })}
            </button>
          </div>
          <div className="flex-1" />
          <button onClick={onClose} className="text-slate-400 hover:text-white p-1" aria-label={t({ ko: '닫기', en: 'Close' })}><X width={18} height={18} /></button>
        </div>

        {error && <div className="border-b border-rose-500/30 bg-rose-500/10 px-4 py-2 text-xs text-rose-300">{error} <button onClick={() => setError('')} className="ml-2 underline">dismiss</button></div>}

        {/* Agents Tab */}
        {tab === 'agents' && (
          <div className="flex-1 overflow-y-auto p-4">
            <div className="mb-3 flex items-center justify-between">
              <span className="text-xs text-slate-400">{agents.length} {t({ ko: '명', en: 'agents' })}</span>
              <button onClick={() => setAgentForm({})} className="rounded bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-500">
                + {t({ ko: '새 에이전트 채용', en: 'Hire New Agent' })}
              </button>
            </div>
            <div className="space-y-2">
              {agents.map(a => (
                <div key={a.id} className="flex items-center gap-3 rounded-lg border border-slate-700 bg-slate-800/50 px-3 py-2">
                  <AvatarDisplay avatarEmoji={a.avatar_emoji} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-medium text-white">{a.name} <span className="text-slate-500">({a.name_ko})</span></p>
                    <p className="text-[10px] text-slate-500">{a.role} · {a.cli_provider} · Sprite #{a.sprite_number ?? 1}</p>
                  </div>
                  <span className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${a.status === 'working' ? 'bg-emerald-500/20 text-emerald-300' : a.status === 'idle' ? 'bg-slate-600/30 text-slate-400' : 'bg-amber-500/20 text-amber-300'}`}>{a.status}</span>
                  <button onClick={() => setAgentForm(a)} className="rounded border border-slate-600 px-2 py-1 text-[10px] text-slate-300 hover:text-white">{t({ ko: '편집', en: 'Edit' })}</button>
                  <button onClick={() => handleAgentDelete(a.id)} disabled={a.status === 'working'} className="rounded border border-red-700/60 px-2 py-1 text-[10px] text-red-400 hover:text-red-300 disabled:opacity-30">{t({ ko: '삭제', en: 'Delete' })}</button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Departments Tab */}
        {tab === 'departments' && (
          <div className="flex-1 overflow-y-auto p-4">
            <div className="mb-3 flex items-center justify-between">
              <span className="text-xs text-slate-400">{deptList.length} {t({ ko: '개 부서', en: 'departments' })}</span>
              <button onClick={() => setDeptForm({})} className="rounded bg-purple-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-purple-500">
                + {t({ ko: '새 부서', en: 'New Department' })}
              </button>
            </div>
            <div className="space-y-2">
              {deptList.map((d, idx) => (
                <div key={d.id} className="flex items-center gap-3 rounded-lg border border-slate-700 bg-slate-800/50 px-3 py-2">
                  <div className="flex flex-col gap-0.5">
                    <button disabled={idx === 0} onClick={() => handleDeptReorder(idx, -1)} className="text-[10px] text-slate-500 hover:text-white disabled:opacity-20">▲</button>
                    <button disabled={idx === deptList.length - 1} onClick={() => handleDeptReorder(idx, 1)} className="text-[10px] text-slate-500 hover:text-white disabled:opacity-20">▼</button>
                  </div>
                  <span className="text-lg">{d.icon}</span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-medium text-white">{d.name} <span className="text-slate-500">({d.name_ko})</span></p>
                    <p className="text-[10px] text-slate-500">{d.id} · {d.agent_count ?? 0} agents · {d.description ?? ''}</p>
                  </div>
                  <span className="h-3 w-3 rounded-full" style={{ backgroundColor: d.color }} />
                  <button onClick={() => setDeptForm(d)} className="rounded border border-slate-600 px-2 py-1 text-[10px] text-slate-300 hover:text-white">{t({ ko: '편집', en: 'Edit' })}</button>
                  <button onClick={() => handleDeptDelete(d.id)} className="rounded border border-red-700/60 px-2 py-1 text-[10px] text-red-400 hover:text-red-300">{t({ ko: '삭제', en: 'Delete' })}</button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {agentForm !== null && <AgentFormModal agent={agentForm} departments={departments} onSave={handleAgentSave} onCancel={() => setAgentForm(null)} />}
      {deptForm !== null && <DeptFormModal dept={deptForm} onSave={handleDeptSave} onCancel={() => setDeptForm(null)} />}
    </div>
  );
}
