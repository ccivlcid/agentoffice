import { useCallback, useEffect, useRef, useState } from 'react';
import {
  disconnectOAuth,
  pollGitHubDevice,
  startGitHubDeviceFlow,
} from '../../api';
import { useI18n } from '../../i18n';

interface GitHubDeviceConnectProps {
  reason: 'not_connected' | 'missing_repo_scope';
  onConnected: () => void;
  onCancel: () => void;
}

export default function GitHubDeviceConnect({
  reason,
  onConnected,
  onCancel,
}: GitHubDeviceConnectProps) {
  const { t } = useI18n();
  const [deviceUserCode, setDeviceUserCode] = useState<string | null>(null);
  const [deviceVerifyUrl, setDeviceVerifyUrl] = useState<string | null>(null);
  const [deviceStateId, setDeviceStateId] = useState<string | null>(null);
  const [deviceStatus, setDeviceStatus] = useState<'idle' | 'waiting' | 'complete' | 'error'>('idle');
  const [deviceError, setDeviceError] = useState<string | null>(null);
  const [disconnecting, setDisconnecting] = useState(false);
  const pollTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    return () => { if (pollTimer.current) clearTimeout(pollTimer.current); };
  }, []);

  const startFlow = useCallback(async () => {
    setDeviceError(null);
    setDeviceStatus('idle');

    // If reconnecting, disconnect first
    if (reason === 'missing_repo_scope') {
      setDisconnecting(true);
      try { await disconnectOAuth("github-copilot"); } catch { /* ok */ }
      setDisconnecting(false);
    }

    try {
      const dc = await startGitHubDeviceFlow();
      setDeviceUserCode(dc.userCode);
      setDeviceVerifyUrl(dc.verificationUri);
      setDeviceStateId(dc.stateId);
      setDeviceStatus('waiting');

      // Open GitHub verification page
      window.open(dc.verificationUri, '_blank');

      // Recursive polling with dynamic interval (handles slow_down)
      let intervalMs = (dc.interval || 5) * 1000;
      let stopped = false;
      const poll = () => {
        if (stopped) return;
        pollTimer.current = setTimeout(async () => {
          if (stopped) return;
          try {
            const result = await pollGitHubDevice(dc.stateId);
            if (result.status === 'complete') {
              stopped = true;
              setDeviceStatus('complete');
              setTimeout(onConnected, 500);
              return;
            } else if (result.status === 'expired' || result.status === 'denied') {
              stopped = true;
              setDeviceStatus('error');
              setDeviceError(result.status === 'expired' ? 'Code expired' : 'Access denied');
              return;
            } else if (result.status === 'slow_down') {
              // GitHub requires us to increase interval by 5 seconds
              intervalMs += 5000;
            }
          } catch (pollErr) {
            console.error('[GitHubImport] poll error:', pollErr);
          }
          poll(); // schedule next
        }, intervalMs);
      };
      poll();
    } catch (err) {
      setDeviceStatus('error');
      setDeviceError(err instanceof Error ? err.message : String(err));
    }
  }, [reason, onConnected]);

  const description = reason === 'not_connected'
    ? t({
        ko: 'GitHub 계정을 연결하면 리포지토리를 가져올 수 있습니다.',
        en: 'Connect your GitHub account to import repositories.',
})
    : t({
        ko: '현재 GitHub 토큰에 repo 권한이 없습니다. 재연결하면 private 리포를 포함한 전체 저장소에 접근할 수 있습니다.',
        en: 'Current GitHub token lacks repo scope. Reconnect to access all repositories including private ones.',
});

  return (
    <div className="space-y-4 p-6">
      <p className="text-sm text-slate-300">{description}</p>

      {deviceStatus === 'idle' && (
        <div className="flex gap-2">
          <button
            type="button"
            disabled={disconnecting}
            onClick={() => void startFlow()}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-500 disabled:opacity-50"
          >
            {disconnecting
              ? t({ ko: '연결 해제 중...', en: 'Disconnecting...' })
              : reason === 'not_connected'
                ? t({ ko: 'GitHub 연결', en: 'Connect GitHub' })
                : t({ ko: 'GitHub 재연결 (repo 권한)', en: 'Reconnect GitHub (repo scope)' })}
          </button>
          <button type="button" onClick={onCancel} className="rounded-lg border border-slate-700 px-3 py-2 text-xs text-slate-300">
            {t({ ko: '닫기', en: 'Close' })}
          </button>
        </div>
      )}

      {deviceStatus === 'waiting' && deviceUserCode && (
        <div className="space-y-3 rounded-xl border border-blue-500/30 bg-blue-900/20 p-4">
          <p className="text-xs text-slate-300">
            {t({
              ko: '아래 코드를 GitHub 인증 페이지에 입력하세요:',
              en: 'Enter this code on the GitHub verification page:',
})}
          </p>
          <div className="flex items-center gap-3">
            <code className="rounded-lg bg-slate-800 px-4 py-2 text-lg font-bold tracking-widest text-white">{deviceUserCode}</code>
            <button
              type="button"
              onClick={() => { void navigator.clipboard.writeText(deviceUserCode); }}
              className="rounded border border-slate-600 px-2 py-1 text-xs text-slate-300 hover:bg-slate-700"
            >
              {t({ ko: '복사', en: 'Copy' })}
            </button>
          </div>
          {deviceVerifyUrl && (
            <a
              href={deviceVerifyUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-block text-xs text-blue-400 underline hover:text-blue-300"
            >
              {t({ ko: 'GitHub 인증 페이지 열기', en: 'Open GitHub verification page' })}
            </a>
          )}
          <p className="animate-pulse text-xs text-slate-400">
            {t({ ko: '인증 대기 중...', en: 'Waiting for authorization...' })}
          </p>
        </div>
      )}

      {deviceStatus === 'complete' && (
        <div className="rounded-lg border border-green-500/20 bg-green-500/10 px-3 py-2 text-xs text-green-400">
          {t({ ko: 'GitHub 연결 완료! 리포 목록을 불러옵니다...', en: 'GitHub connected! Loading repositories...' })}
        </div>
      )}

      {deviceStatus === 'error' && (
        <div className="space-y-2">
          <div className="rounded-lg border border-rose-500/60 bg-rose-500/10 px-3 py-2 text-xs text-rose-200">
            {deviceError}
          </div>
          <button
            type="button"
            onClick={() => { setDeviceStatus('idle'); setDeviceError(null); }}
            className="rounded-lg border border-slate-700 px-3 py-1.5 text-xs text-slate-300"
          >
            {t({ ko: '다시 시도', en: 'Try again' })}
          </button>
        </div>
      )}
    </div>
  );
}
