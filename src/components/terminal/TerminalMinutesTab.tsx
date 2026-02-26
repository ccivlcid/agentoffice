import type { MeetingMinute } from '../../types';
import { useI18n } from '../../i18n';
import { FileText } from 'lucide-react';

interface TerminalMinutesTabProps {
  meetingMinutes: MeetingMinute[];
}

export default function TerminalMinutesTab({ meetingMinutes }: TerminalMinutesTabProps) {
  const { t, locale } = useI18n();
  const tr = (ko: string, en: string, ja = en, zh = en) => t({ ko, en, ja, zh });

  function meetingTypeLabel(type: 'planned' | 'review'): string {
    return type === 'planned'
      ? tr('Planned 승인', 'Planned Approval', 'Planned 承認', 'Planned 审批')
      : tr('Review 승인', 'Review Approval', 'Review 承認', 'Review 审批');
  }

  function meetingStatusLabel(status: MeetingMinute['status']): string {
    if (status === 'completed') return tr('완료', 'Completed', '完了', '已完成');
    if (status === 'revision_requested') return tr('보완 요청', 'Revision Requested', '修正要請', '要求修订');
    if (status === 'failed') return tr('실패', 'Failed', '失敗', '失败');
    return tr('진행중', 'In Progress', '進行中', '进行中');
  }

  if (meetingMinutes.length === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center" style={{ color: 'var(--th-text-muted)' }}>
        <FileText className="mb-3 h-12 w-12 shrink-0" style={{ color: 'var(--th-text-muted)' }} aria-hidden />
        <div className="text-sm">
          {tr('회의록이 아직 없습니다', 'No meeting minutes yet', '会議録はまだありません', '暂无会议纪要')}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {meetingMinutes.map((meeting) => (
        <div key={meeting.id} className="rounded-xl border p-3" style={{ borderColor: 'var(--th-border)', background: 'var(--th-card-bg)' }}>
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <span className="rounded bg-cyan-900/50 px-2 py-0.5 text-[10px] text-cyan-200">
              {meetingTypeLabel(meeting.meeting_type)}
            </span>
            <span className="rounded px-2 py-0.5 text-[10px]" style={{ background: 'var(--th-bg-surface)', color: 'var(--th-text-primary)' }}>
              {tr('라운드', 'Round', 'ラウンド', '轮次')} {meeting.round}
            </span>
            <span className="rounded px-2 py-0.5 text-[10px]" style={{ background: 'var(--th-bg-surface)', color: 'var(--th-text-primary)' }}>
              {meetingStatusLabel(meeting.status)}
            </span>
            <span className="ml-auto text-[10px]" style={{ color: 'var(--th-text-muted)' }}>
              {new Date(meeting.started_at).toLocaleString(locale)}
            </span>
          </div>
          <div className="space-y-1.5">
            {meeting.entries.map((entry) => (
              <div key={entry.id} className="rounded-md border px-2 py-1.5" style={{ borderColor: 'var(--th-border)', background: 'var(--th-panel-bg)' }}>
                <div className="mb-0.5 flex items-center gap-2 text-[10px]" style={{ color: 'var(--th-text-secondary)' }}>
                  <span>#{entry.seq}</span>
                  <span className="text-cyan-300">{entry.speaker_name}</span>
                  {entry.department_name && <span>{entry.department_name}</span>}
                  {entry.role_label && <span>· {entry.role_label}</span>}
                </div>
                <div className="text-xs leading-relaxed whitespace-pre-wrap break-words" style={{ color: 'var(--th-text-primary)' }}>
                  {entry.content}
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
