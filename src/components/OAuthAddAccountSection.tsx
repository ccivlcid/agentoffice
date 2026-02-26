/**
 * "Add OAuth Account" section: connectable provider buttons + device code flow.
 */
import { useSettingsPanel } from './SettingsPanelContext';
import {
  CONNECTABLE_PROVIDERS,
  GitHubOAuthAppConfig,
} from './SettingsPanelShared';

export function OAuthAddAccountSection() {
  const {
    t,
    deviceCode,
    deviceStatus,
    deviceError,
    startDeviceCodeFlow,
    handleConnect,
  } = useSettingsPanel();

  return (
    <div className="rounded-xl border border-slate-700/50 bg-slate-800/40 p-4 space-y-3">
      <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
        {t({ ko: 'OAuth 계정 추가', en: 'Add OAuth Account' })}
      </h4>
      <div className="flex flex-wrap gap-3">
        {CONNECTABLE_PROVIDERS.map(({ id, label, Logo, description }) => (
          <div
            key={id}
            className="flex flex-col gap-2 rounded-lg border border-slate-600/50 p-3 min-w-[180px]"
          >
            <div className="flex items-center gap-2">
              <Logo className="w-5 h-5 text-slate-300" />
              <span className="text-sm text-slate-200">{label}</span>
            </div>
            <p className="text-[11px] text-slate-500">{description}</p>
            {id === 'github-copilot' ? (
              <div className="space-y-2">
                <button
                  onClick={startDeviceCodeFlow}
                  disabled={!!deviceCode}
                  className="w-full px-3 py-1.5 rounded-lg bg-slate-600 hover:bg-slate-500 text-white text-xs font-medium disabled:opacity-50"
                >
                  {deviceCode
                    ? t({ ko: '디바이스 코드 대기 중...', en: 'Waiting for device code...' })
                    : t({ ko: '디바이스 코드로 연결', en: 'Connect with device code' })}
                </button>
                {deviceCode && (
                  <div className="text-[11px] text-slate-400 space-y-1">
                    <p>
                      {t({ ko: '코드', en: 'Code' })}: <strong className="font-mono">{deviceCode.userCode}</strong>
                    </p>
                    <p>
                      <a
                        href={deviceCode.verificationUri}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-400 hover:underline"
                      >
                        {deviceCode.verificationUri}
                      </a>
                    </p>
                  </div>
                )}
                {deviceStatus === 'complete' && (
                  <p className="text-xs text-green-400">
                    {t({ ko: '연결 완료', en: 'Connection complete' })}
                  </p>
                )}
                {(deviceStatus === 'expired' || deviceStatus === 'denied' || deviceStatus === 'error') && (
                  <p className="text-xs text-red-400">{deviceError ?? deviceStatus}</p>
                )}
              </div>
            ) : (
              <button
                onClick={() => handleConnect(id)}
                className="w-full px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium"
              >
                {t({ ko: '연결하기', en: 'Connect' })}
              </button>
            )}
          </div>
        ))}
      </div>
      <GitHubOAuthAppConfig t={t} />
    </div>
  );
}
