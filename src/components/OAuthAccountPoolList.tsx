/**
 * Account pool list for a single OAuth provider.
 */
import type { OAuthAccountInfo, OAuthConnectProvider } from '../api';
import { useSettingsPanel } from './SettingsPanelContext';

interface Props {
  accounts: OAuthAccountInfo[];
  providerId: OAuthConnectProvider;
  activeAccountIds?: string[];
  activeAccountId?: string;
}

export function OAuthAccountPoolList({ accounts, providerId, activeAccountIds, activeAccountId }: Props) {
  const {
    t,
    accountDrafts,
    savingAccountId,
    updateAccountDraft,
    handleActivateAccount,
    handleSaveAccount,
    handleToggleAccount,
    handleDeleteAccount,
  } = useSettingsPanel();

  return (
    <div className="space-y-2">
      <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
        {t({ ko: '계정 풀', en: 'Account pool' })}
      </h4>
      {accounts.map((acc) => {
        const draft = accountDrafts[acc.id] ?? {
          label: acc.label ?? '',
          modelOverride: acc.modelOverride ?? '',
          priority: String(acc.priority ?? 100),
        };
        const isActive = activeAccountIds?.includes(acc.id) ?? acc.id === activeAccountId;
        const isSaving = savingAccountId === acc.id;
        const status = acc.status ?? 'active';
        return (
          <div
            key={acc.id}
            className="flex flex-wrap items-center gap-2 rounded-lg bg-slate-700/30 p-2 text-xs"
          >
            <input
              type="text"
              placeholder={t({ ko: '라벨', en: 'Label' })}
              value={draft.label}
              onChange={(e) => updateAccountDraft(acc.id, { label: e.target.value })}
              className="w-24 min-w-0 px-2 py-1 bg-slate-800 border border-slate-600 rounded text-white"
            />
            <input
              type="text"
              placeholder={t({ ko: '모델 오버라이드', en: 'Model override' })}
              value={draft.modelOverride}
              onChange={(e) => updateAccountDraft(acc.id, { modelOverride: e.target.value })}
              className="w-32 min-w-0 px-2 py-1 bg-slate-800 border border-slate-600 rounded text-white font-mono"
            />
            <input
              type="text"
              placeholder="100"
              value={draft.priority}
              onChange={(e) => updateAccountDraft(acc.id, { priority: e.target.value })}
              className="w-14 px-2 py-1 bg-slate-800 border border-slate-600 rounded text-white"
            />
            <span className="text-slate-500">
              {t({ ko: '풀 켜기/끄기', en: 'Pool On/Off' })}:
            </span>
            <button
              onClick={() => handleActivateAccount(providerId, acc.id, isActive)}
              disabled={isSaving}
              className={`px-2 py-0.5 rounded ${isActive ? 'bg-blue-600 text-white' : 'bg-slate-600 text-slate-400'}`}
            >
              {isActive
                ? t({ ko: '켜짐', en: 'On' })
                : t({ ko: '꺼짐', en: 'Off' })}
            </button>
            <button
              onClick={() => handleSaveAccount(acc.id)}
              disabled={isSaving}
              className="text-blue-400 hover:text-blue-300"
            >
              {t({ ko: '저장', en: 'Save' })}
            </button>
            <button
              onClick={() => handleToggleAccount(acc.id, status === 'active' ? 'disabled' : 'active')}
              disabled={isSaving}
              className="text-slate-400 hover:text-slate-300"
            >
              {status === 'active'
                ? t({ ko: '비활성화', en: 'Disable' })
                : t({ ko: '활성화', en: 'Enable' })}
            </button>
            <button
              onClick={() => handleDeleteAccount(providerId, acc.id)}
              disabled={isSaving}
              className="text-red-400 hover:text-red-300"
            >
              {t({ ko: '삭제', en: 'Delete' })}
            </button>
          </div>
        );
      })}
    </div>
  );
}
