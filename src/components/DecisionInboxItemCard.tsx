import type { UiLanguage } from '../i18n';
import { pickLang } from '../i18n';
import type { Agent } from '../types';
import AgentAvatar from './AgentAvatar';
import MessageContent from './MessageContent';
import type { DecisionInboxItem } from './chat/decision-inbox';
import { UserCheck, Timer, Receipt, Bot } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

interface DecisionInboxItemCardProps {
  item: DecisionInboxItem;
  agent: Agent | undefined;
  spriteMap: Map<string, number>;
  isKorean: boolean;
  busyKey: string | null;
  uiLanguage: UiLanguage;
  reviewPickSelected: number[];
  reviewPickDraft: string;
  onOpenChat: (agentId: string) => void;
  onOptionClick: (optionNumber: number, action?: string) => void;
  onToggleReviewPick: (optionNumber: number) => void;
  onSetReviewDraft: (value: string) => void;
  onSubmitReviewPick: () => void;
  onSkipReviewRound: () => void;
}

function formatTime(ts: number, locale: UiLanguage): string {
  return new Intl.DateTimeFormat(locale, {
    month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit',
  }).format(new Date(ts));
}

export default function DecisionInboxItemCard({
  item, agent, spriteMap, isKorean, busyKey, uiLanguage,
  reviewPickSelected, reviewPickDraft,
  onOpenChat, onOptionClick, onToggleReviewPick, onSetReviewDraft,
  onSubmitReviewPick, onSkipReviewRound,
}: DecisionInboxItemCardProps) {
  const t = (text: { ko: string; en: string; ja?: string; zh?: string }) => pickLang(uiLanguage, text);
  const isItemBusy = Boolean(busyKey?.startsWith(`${item.id}:`));

  function getKindLabel(kind: DecisionInboxItem['kind']): string {
    if (kind === 'project_review_ready') return t({ ko: '프로젝트 의사결정', en: 'Project Decision' });
    if (kind === 'task_timeout_resume') return t({ ko: '중단 작업 재개', en: 'Timeout Resume' });
    if (kind === 'review_round_pick') return t({ ko: '리뷰 라운드 의사결정', en: 'Review Round Decision' });
    return t({ ko: '에이전트 요청', en: 'Agent Request' });
  }

  function getKindIcon(kind: DecisionInboxItem['kind']): LucideIcon {
    if (kind === 'project_review_ready') return UserCheck;
    if (kind === 'task_timeout_resume') return Timer;
    if (kind === 'review_round_pick') return Receipt;
    return Bot;
  }

  const pickOptions = item.options.filter((o) => o.action === 'apply_review_pick');
  const skipOption = item.options.find((o) => o.action === 'skip_to_next_round');
  const sendingLabel = t({ ko: '전송 중...', en: 'Sending...' });

  return (
    <div className="rounded-xl border border-slate-700/60 bg-slate-800/50 p-3">
      {/* Card header */}
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <div className="flex min-w-0 items-start gap-2">
          {agent ? (
            <AgentAvatar agent={agent} spriteMap={spriteMap} size={32} className="mt-0.5 border border-slate-600 bg-slate-900" />
          ) : item.agentAvatar ? (
            <span className="mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-slate-600 bg-slate-900 text-base">
              {item.agentAvatar}
            </span>
          ) : (
            <span className="mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-slate-600 bg-slate-900 text-slate-400">
              {(() => { const Icon = getKindIcon(item.kind); return <Icon width={18} height={18} aria-hidden />; })()}
            </span>
          )}
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-white">
              {isKorean ? item.agentNameKo : item.agentName}
            </p>
            <p className="text-[11px] text-indigo-300/90">{getKindLabel(item.kind)}</p>
            <p className="text-[11px] text-slate-400">{formatTime(item.createdAt, uiLanguage)}</p>
          </div>
        </div>
        {item.agentId && (
          <button
            onClick={() => onOpenChat(item.agentId!)}
            className="rounded-md border border-slate-600 px-2 py-1 text-[11px] text-slate-300 transition hover:border-slate-400 hover:bg-slate-700 hover:text-white"
          >
            {t({ ko: '채팅 열기', en: 'Open Chat' })}
          </button>
        )}
      </div>

      {/* Request content */}
      <div className="rounded-lg border border-slate-700/70 bg-slate-900/60 px-2.5 py-2 text-xs text-slate-200">
        <MessageContent content={item.requestContent} />
      </div>

      {/* Options */}
      <div className="mt-2 space-y-1.5">
        {item.kind === 'review_round_pick' ? (
          item.options.length === 0 ? (
            <p className="rounded-md border border-slate-700/70 bg-slate-900/50 px-2.5 py-2 text-xs text-slate-400">
              {t({ ko: '기획팀장 의견 취합중...', en: 'Planning lead is consolidating opinions...' })}
            </p>
          ) : (
            <div className="space-y-2">
              {pickOptions.map((option) => (
                <button
                  key={`${item.id}:${option.number}`}
                  type="button"
                  onClick={() => onToggleReviewPick(option.number)}
                  disabled={isItemBusy}
                  className={`decision-inbox-option w-full rounded-md px-2.5 py-1.5 text-left text-xs transition disabled:cursor-not-allowed disabled:opacity-60${reviewPickSelected.includes(option.number) ? ' decision-inbox-option-active' : ''}`}
                >
                  {`${option.number}. ${option.label}`}
                </button>
              ))}
              <p className="text-[11px] text-slate-400">
                {t({ ko: `선택 항목: ${reviewPickSelected.length}건`, en: `Selected: ${reviewPickSelected.length} item(s)`, ja: `選択項目: ${reviewPickSelected.length}件`, zh: `已选项: ${reviewPickSelected.length} 项` })}
              </p>
              <textarea
                value={reviewPickDraft}
                onChange={(e) => onSetReviewDraft(e.target.value)}
                rows={2}
                placeholder={t({ ko: '추가 의견이 있으면 입력해 주세요. (선택)', en: 'Enter extra notes if needed. (Optional)' })}
                className="w-full resize-y rounded-lg border border-slate-600 bg-slate-950 px-3 py-2 text-xs text-slate-100 placeholder:text-slate-500 focus:border-indigo-400 focus:outline-none"
              />
              <div className="flex flex-wrap items-center justify-end gap-2">
                {skipOption && (
                  <button
                    type="button"
                    onClick={onSkipReviewRound}
                    disabled={isItemBusy}
                    className="decision-round-skip rounded-md px-3 py-1.5 text-xs font-semibold transition disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {isItemBusy ? sendingLabel : `${skipOption.number}. ${skipOption.label}`}
                  </button>
                )}
                <button
                  type="button"
                  onClick={onSubmitReviewPick}
                  disabled={isItemBusy}
                  className="decision-round-submit rounded-md px-3 py-1.5 text-xs font-semibold transition disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isItemBusy ? sendingLabel : t({ ko: '선택 항목 진행', en: 'Run Selected' })}
                </button>
              </div>
            </div>
          )
        ) : item.options.length > 0 ? (
          item.options.map((option) => {
            const key = `${item.id}:${option.number}`;
            return (
              <button
                key={key}
                type="button"
                onClick={() => onOptionClick(option.number, option.action)}
                disabled={busyKey === key}
                className="decision-inbox-option w-full rounded-md px-2.5 py-1.5 text-left text-xs transition disabled:cursor-not-allowed disabled:opacity-60"
              >
                {busyKey === key ? sendingLabel : `${option.number}. ${option.label}`}
              </button>
            );
          })
        ) : (
          <p className="rounded-md border border-slate-700/70 bg-slate-900/50 px-2.5 py-2 text-xs text-slate-400">
            {item.kind === 'project_review_ready'
              ? t({ ko: '기획팀장 의견 취합중...', en: 'Planning lead is consolidating opinions...' })
              : t({ ko: '선택지 준비 중...', en: 'Options are being prepared...' })}
          </p>
        )}
      </div>
    </div>
  );
}
