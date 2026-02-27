import { useEffect, useMemo, useRef, useState } from 'react';
import type { UiLanguage } from '../i18n';
import { pickLang } from '../i18n';
import type { Agent } from '../types';
import { useModalFocus } from '../hooks/useModalFocus';
import { buildSpriteMap } from './AgentAvatar';
import type { DecisionInboxItem } from './chat/decision-inbox';
import DecisionInboxItemCard from './DecisionInboxItemCard';
import DecisionInboxFollowup from './DecisionInboxFollowup';
import { Compass, X } from 'lucide-react';

interface DecisionInboxModalProps {
  open: boolean;
  loading: boolean;
  items: DecisionInboxItem[];
  agents: Agent[];
  busyKey: string | null;
  uiLanguage: UiLanguage;
  onClose: () => void;
  onRefresh: () => void;
  onReplyOption: (
    item: DecisionInboxItem,
    optionNumber: number,
    payload?: { note?: string; selected_option_numbers?: number[] },
  ) => void;
  onOpenChat: (agentId: string) => void;
}

export default function DecisionInboxModal({
  open, loading, items, agents, busyKey, uiLanguage,
  onClose, onRefresh, onReplyOption, onOpenChat,
}: DecisionInboxModalProps) {
  if (!open) return null;

  const t = (text: { ko: string; en: string; ja?: string; zh?: string }) => pickLang(uiLanguage, text);
  const isKorean = uiLanguage.startsWith('ko');
  const spriteMap = useMemo(() => buildSpriteMap(agents), [agents]);
  const agentById = useMemo(() => {
    const map = new Map<string, Agent>();
    for (const agent of agents) map.set(agent.id, agent);
    return map;
  }, [agents]);

  const contentRef = useRef<HTMLDivElement>(null);
  useModalFocus(open, contentRef);

  const [followupTarget, setFollowupTarget] = useState<{ itemId: string; optionNumber: number } | null>(null);
  const [followupDraft, setFollowupDraft] = useState('');
  const [reviewPickSelections, setReviewPickSelections] = useState<Record<string, number[]>>({});
  const [reviewPickDrafts, setReviewPickDrafts] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!open) {
      setFollowupTarget(null);
      setFollowupDraft('');
      setReviewPickSelections({});
      setReviewPickDrafts({});
      return;
    }
    if (!followupTarget) return;
    if (!items.some((e) => e.id === followupTarget.itemId)) {
      setFollowupTarget(null);
      setFollowupDraft('');
    }
  }, [open, followupTarget, items]);

  useEffect(() => {
    const keep = new Set(items.map((item) => item.id));
    setReviewPickSelections((prev) => {
      const next: Record<string, number[]> = {};
      let changed = false;
      for (const [id, nums] of Object.entries(prev)) {
        if (!keep.has(id)) { changed = true; continue; }
        next[id] = nums;
      }
      return changed ? next : prev;
    });
    setReviewPickDrafts((prev) => {
      const next: Record<string, string> = {};
      let changed = false;
      for (const [id, draft] of Object.entries(prev)) {
        if (!keep.has(id)) { changed = true; continue; }
        next[id] = draft;
      }
      return changed ? next : prev;
    });
  }, [items]);

  const followupItem = useMemo(
    () => followupTarget ? items.find((e) => e.id === followupTarget.itemId) ?? null : null,
    [followupTarget, items],
  );
  const followupBusyKey = followupTarget ? `${followupTarget.itemId}:${followupTarget.optionNumber}` : null;
  const isFollowupSubmitting = followupBusyKey ? busyKey === followupBusyKey : false;
  const canSubmitFollowup = !!(followupItem && followupDraft.trim() && !isFollowupSubmitting);

  function handleOptionClick(item: DecisionInboxItem, optionNumber: number, action?: string) {
    if (action === 'add_followup_request') {
      setFollowupTarget({ itemId: item.id, optionNumber });
      setFollowupDraft('');
      return;
    }
    onReplyOption(item, optionNumber);
  }

  function handleSubmitFollowup() {
    if (!followupItem || !followupTarget) return;
    const note = followupDraft.trim();
    if (!note) return;
    onReplyOption(followupItem, followupTarget.optionNumber, { note });
    setFollowupTarget(null);
    setFollowupDraft('');
  }

  function handleSubmitReviewPick(item: DecisionInboxItem) {
    const pickOptions = item.options.filter((o) => o.action === 'apply_review_pick');
    const selected = reviewPickSelections[item.id] ?? [];
    const extraNote = (reviewPickDrafts[item.id] ?? '').trim();
    const optionNumber = selected[0] ?? pickOptions[0]?.number;
    if (!optionNumber) return;
    if (selected.length <= 0 && !extraNote) {
      window.alert(t({ ko: '최소 1개 선택하거나 추가 의견을 입력해 주세요.', en: 'Pick at least one option or enter an extra note.' }));
      return;
    }
    onReplyOption(item, optionNumber, { selected_option_numbers: selected, ...(extraNote ? { note: extraNote } : {}) });
    setReviewPickSelections((prev) => { const next = { ...prev }; delete next[item.id]; return next; });
    setReviewPickDrafts((prev) => { const next = { ...prev }; delete next[item.id]; return next; });
  }

  function handleSkipReviewRound(item: DecisionInboxItem) {
    const skipOption = item.options.find((o) => o.action === 'skip_to_next_round');
    if (!skipOption) return;
    setReviewPickSelections((prev) => { const next = { ...prev }; delete next[item.id]; return next; });
    setReviewPickDrafts((prev) => { const next = { ...prev }; delete next[item.id]; return next; });
    onReplyOption(item, skipOption.number);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={onClose}>
      <div
        ref={contentRef}
        className="relative mx-4 w-full max-w-3xl rounded-2xl border border-indigo-500/30 bg-slate-900 shadow-2xl shadow-indigo-500/10"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-700/50 px-6 py-4">
          <div className="flex items-center gap-3">
            <Compass width={24} height={24} className="text-indigo-400 shrink-0" aria-hidden />
            <h2 className="text-lg font-bold text-white">
              {t({ ko: '미결 의사결정', en: 'Pending Decisions' })}
            </h2>
            <span className="rounded-full bg-indigo-500/20 px-2 py-0.5 text-xs font-medium text-indigo-300">
              {items.length}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={onRefresh} className="rounded-lg border border-slate-700 px-3 py-1.5 text-xs text-slate-300 transition hover:bg-slate-800 hover:text-white">
              {t({ ko: '새로고침', en: 'Refresh' })}
            </button>
            <button onClick={onClose} className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-800 hover:text-white" aria-label={t({ ko: '닫기', en: 'Close' })}><X width={18} height={18} aria-hidden /></button>
          </div>
        </div>

        {/* Items list */}
        <div className="max-h-[70vh] overflow-y-auto p-4">
          {loading ? (
            <div className="py-12 text-center text-sm text-slate-500">
              {t({ ko: '미결 목록 불러오는 중...', en: 'Loading pending decisions...' })}
            </div>
          ) : items.length === 0 ? (
            <div className="py-12 text-center text-sm text-slate-500">
              {t({ ko: '현재 미결 의사결정이 없습니다.', en: 'No pending decisions right now.' })}
            </div>
          ) : (
            <div className="space-y-3">
              {items.map((item) => (
                <DecisionInboxItemCard
                  key={item.id}
                  item={item}
                  agent={item.agentId ? agentById.get(item.agentId) : undefined}
                  spriteMap={spriteMap}
                  isKorean={isKorean}
                  busyKey={busyKey}
                  uiLanguage={uiLanguage}
                  reviewPickSelected={reviewPickSelections[item.id] ?? []}
                  reviewPickDraft={reviewPickDrafts[item.id] ?? ''}
                  onOpenChat={onOpenChat}
                  onOptionClick={(num, action) => handleOptionClick(item, num, action)}
                  onToggleReviewPick={(num) => setReviewPickSelections((prev) => {
                    const cur = prev[item.id] ?? [];
                    const next = cur.includes(num) ? cur.filter((n) => n !== num) : [...cur, num].sort((a, b) => a - b);
                    return { ...prev, [item.id]: next };
                  })}
                  onSetReviewDraft={(val) => setReviewPickDrafts((prev) => ({ ...prev, [item.id]: val }))}
                  onSubmitReviewPick={() => handleSubmitReviewPick(item)}
                  onSkipReviewRound={() => handleSkipReviewRound(item)}
                />
              ))}
            </div>
          )}
        </div>

        {followupItem && (
          <DecisionInboxFollowup
            followupItem={followupItem}
            followupDraft={followupDraft}
            isSubmitting={isFollowupSubmitting}
            canSubmit={canSubmitFollowup}
            uiLanguage={uiLanguage}
            onChange={setFollowupDraft}
            onSubmit={handleSubmitFollowup}
            onCancel={() => { setFollowupTarget(null); setFollowupDraft(''); }}
          />
        )}
      </div>
    </div>
  );
}
