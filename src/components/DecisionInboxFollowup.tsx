import type { UiLanguage } from '../i18n';
import { pickLang } from '../i18n';
import type { DecisionInboxItem } from './chat/decision-inbox';

interface DecisionInboxFollowupProps {
  followupItem: DecisionInboxItem;
  followupDraft: string;
  isSubmitting: boolean;
  canSubmit: boolean;
  uiLanguage: UiLanguage;
  onChange: (value: string) => void;
  onSubmit: () => void;
  onCancel: () => void;
}

export default function DecisionInboxFollowup({
  followupItem: _followupItem,
  followupDraft,
  isSubmitting,
  canSubmit,
  uiLanguage,
  onChange,
  onSubmit,
  onCancel,
}: DecisionInboxFollowupProps) {
  const t = (text: { ko: string; en: string; ja?: string; zh?: string }) => pickLang(uiLanguage, text);

  return (
    <div className="border-t border-slate-700/60 bg-slate-900/90 px-4 py-3">
      <p className="mb-2 text-xs font-semibold text-slate-200">
        {t({ ko: '추가요청사항 입력', en: 'Additional Follow-up Request' })}
      </p>
      <textarea
        value={followupDraft}
        onChange={(e) => onChange(e.target.value)}
        placeholder={t({ ko: '요청사항을 입력해 주세요.', en: 'Enter your request details.' })}
        rows={3}
        className="w-full resize-y rounded-lg border border-slate-600 bg-slate-950 px-3 py-2 text-xs text-slate-100 placeholder:text-slate-500 focus:border-indigo-400 focus:outline-none"
      />
      <div className="mt-2 flex items-center justify-end gap-2">
        <button
          type="button"
          onClick={onCancel}
          disabled={isSubmitting}
          className="rounded-md border border-slate-600 px-3 py-1.5 text-xs text-slate-300 transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {t({ ko: '취소', en: 'Cancel' })}
        </button>
        <button
          type="button"
          onClick={onSubmit}
          disabled={!canSubmit}
          className="decision-followup-submit rounded-md px-3 py-1.5 text-xs font-semibold transition disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isSubmitting
            ? t({ ko: '전송 중...', en: 'Sending...' })
            : t({ ko: '요청 등록', en: 'Submit Request' })}
        </button>
      </div>
    </div>
  );
}
