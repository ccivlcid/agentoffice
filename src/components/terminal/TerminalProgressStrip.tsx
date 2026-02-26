import { useI18n } from '../../i18n';
import type { TerminalProgressHint, TerminalProgressHintsPayload } from '../../api';
import { Check } from 'lucide-react';

function compactHintText(value: string, max = 90): string {
  const normalized = value.replace(/\s+/g, ' ').trim();
  if (normalized.length <= max) return normalized;
  return `${normalized.slice(0, max - 1).trimEnd()}…`;
}

function shortPath(value: string): string {
  const normalized = value.replace(/\\/g, '/');
  const parts = normalized.split('/').filter(Boolean);
  return parts.length === 0 ? value : parts[parts.length - 1];
}

interface TerminalProgressStripProps {
  progressHints: TerminalProgressHintsPayload;
  activeToolHint: TerminalProgressHint | null;
}

export default function TerminalProgressStrip({ progressHints, activeToolHint }: TerminalProgressStripProps) {
  const { t } = useI18n();
  const tr = (ko: string, en: string, ja = en, zh = en) => t({ ko, en, ja, zh });

  function hintLineLabel(hint: TerminalProgressHint): string {
    const summary = compactHintText(hint.summary, 100);
    if (hint.phase === 'ok') {
      return tr(
        `... ${hint.tool} 확인 완료: ${summary}`,
        `... ${hint.tool} checked: ${summary}`,
        `... ${hint.tool} 確認完了: ${summary}`,
        `... ${hint.tool} 已确认: ${summary}`,
      );
    }
    if (hint.phase === 'error') {
      return tr(
        `... ${hint.tool} 재확인 중: ${summary}`,
        `... ${hint.tool} retry/check: ${summary}`,
        `... ${hint.tool} 再確認中: ${summary}`,
        `... ${hint.tool} 重试/检查: ${summary}`,
      );
    }
    return tr(
      `... ${hint.tool} 진행 중: ${summary}`,
      `... ${hint.tool} in progress: ${summary}`,
      `... ${hint.tool} 実行中: ${summary}`,
      `... ${hint.tool} 进行中: ${summary}`,
    );
  }

  return (
    <div className="terminal-panel-strip border-t px-4 py-2 backdrop-blur-sm">
      <div className="text-[10px] italic" style={{ color: 'var(--th-text-secondary)' }}>
        {activeToolHint
          ? tr(
              `도구 실행중.. ${activeToolHint.tool} 확인 중`,
              `Tool running.. checking ${activeToolHint.tool}`,
              `ツール実行中.. ${activeToolHint.tool} を確認中`,
              `工具运行中.. 正在检查 ${activeToolHint.tool}`,
            )
          : tr(
              '도구 실행중.. 진행 상황 확인 중',
              'Tool running.. checking progress',
              'ツール実行中.. 進捗確認中',
              '工具运行中.. 正在检查进度',
            )}
      </div>
      {progressHints.current_file && (
        <div className="mt-1 text-[10px] break-words" style={{ color: 'var(--th-text-muted)' }}>
          {tr(
            `파일: ${shortPath(progressHints.current_file)}`,
            `file: ${shortPath(progressHints.current_file)}`,
            `ファイル: ${shortPath(progressHints.current_file)}`,
            `文件: ${shortPath(progressHints.current_file)}`,
          )}
        </div>
      )}
      <div className="mt-1 max-h-20 space-y-0.5 overflow-y-auto">
        {progressHints.hints.slice(-4).map((hint, idx) => (
          <div
            key={`${hint.tool}-${hint.phase}-${idx}`}
            className={`text-[10px] italic break-words ${
              hint.phase === 'error' ? 'text-rose-300/75' : 'text-slate-400/85'
            }`}
          >
            {hintLineLabel(hint)}
          </div>
        ))}
      </div>
      {progressHints.ok_items.length > 0 && (
        <div className="mt-1 flex items-center gap-1.5 text-[10px] text-emerald-300/80 break-words">
          <Check width={12} height={12} className="shrink-0" aria-hidden />
          <span>{progressHints.ok_items.map((item) => compactHintText(item, 44)).join(' · ')}</span>
        </div>
      )}
    </div>
  );
}
