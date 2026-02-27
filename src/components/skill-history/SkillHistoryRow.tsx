import type { Agent } from '../../types';
import { getSpriteNum } from '../AgentAvatar';
import { Icon } from '../ui/Icon';
import { BookOpen, Hammer, Leaf, Pencil, Trash2 } from 'lucide-react';
import type { SkillLearningHistoryEntry } from '../../api';
import { providerLabel, relativeTime, statusClass, statusLabel, type UnlearnEffect } from './skillHistoryHelpers';

/** 오피스 캐릭터 썸네일 (이미지 레퍼런스: 토글 | 캐릭터 | 편집 | 삭제) */
function OfficeCharacterThumb({
  spriteNumber,
  size = 24,
  className = '',
}: {
  spriteNumber: number | null | undefined;
  size?: number;
  className?: string;
}) {
  const n = Math.min(13, Math.max(1, Number(spriteNumber) || 1));
  return (
    <div
      className={`overflow-hidden rounded-full bg-white shrink-0 ${className}`}
      style={{
        width: size,
        height: size,
        border: '2px solid #d4a574',
        boxSizing: 'border-box',
      }}
    >
      <img
        src={`/sprites/${n}-D-1.png`}
        alt=""
        className="h-full w-full object-cover object-bottom"
        style={{ imageRendering: 'pixelated' }}
        aria-hidden
      />
    </div>
  );
}

interface SkillHistoryRowProps {
  agent: Agent | null;
  agents: Agent[];
  label: string;
  repo: string;
  providerName: string;
  isUnlearning: boolean;
  unlearnEffect: UnlearnEffect | undefined;
  canUnlearn: boolean;
  timestamp?: number | null;
  status?: SkillLearningHistoryEntry['status'];
  error?: string | null;
  onUnlearn: () => void;
}

export default function SkillHistoryRow({
  agent, agents, label, repo, providerName, isUnlearning,
  unlearnEffect, canUnlearn, timestamp, status, error, onUnlearn,
}: SkillHistoryRowProps) {
  const isOn = status === 'succeeded';
  const spriteNum = agent && agents.length ? getSpriteNum(agents, agent.id) : undefined;

  return (
    <div className="skill-history-card rounded-lg border border-slate-700/70 bg-slate-800/50 p-2.5 transition-all">
      {/* Row 1: icon + label + status badge */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-slate-900/60">
            <BookOpen width={13} height={13} className="text-purple-400" />
          </div>
          <div className="truncate text-xs font-semibold text-slate-100">{label}</div>
        </div>
        {status && (
          <span className={`shrink-0 rounded-full border px-1.5 py-0.5 text-[10px] ${statusClass(status)}`}>
            {statusLabel(status)}
          </span>
        )}
      </div>
      {/* Row 2: repo + time (left) | 토글 | 오피스 캐릭터 | 편집 | 삭제(빨간색) (right) */}
      <div className="mt-1.5 flex items-center justify-between gap-2 text-[10px] text-slate-500">
        <div className="flex min-w-0 items-center gap-2">
          <span className="truncate font-mono">{repo}</span>
          <span className="skill-history-time shrink-0">{relativeTime(timestamp)}</span>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {/* 토글: 학습 성공 시 ON(녹색), 그 외 OFF */}
          <div
            className="shrink-0 w-8 h-4 rounded-full transition-colors relative"
            style={{
              backgroundColor: isOn ? '#22C55E' : 'var(--th-text-muted, #64748b)',
              opacity: isUnlearning ? 0.6 : 1,
            }}
            title={isOn ? 'Succeeded' : status ?? 'Pending'}
          >
            <div
              className="absolute top-0.5 w-3 h-3 rounded-full bg-white transition-all"
              style={{ left: isOn ? 17 : 2 }}
            />
          </div>
          {/* 오피스 캐릭터 (스프라이트) */}
          <div className={`relative ${unlearnEffect ? 'unlearn-avatar-hit' : ''}`}>
            <OfficeCharacterThumb spriteNumber={spriteNum ?? 1} size={24} />
            {unlearnEffect === 'pot' && <span className="unlearn-pot-drop-sm"><Icon icon={Leaf} size="xs" className="text-emerald-400" /></span>}
            {unlearnEffect === 'hammer' && <span className="unlearn-hammer-swing-sm"><Icon icon={Hammer} size="xs" className="text-slate-300" /></span>}
            {unlearnEffect && <span className="unlearn-hit-text-sm">Bonk!</span>}
          </div>
          {/* 편집: 에이전트/프로바이더 정보 툴팁만 (클릭 전파 차단) */}
          <button
            type="button"
            onClick={(e) => e.stopPropagation()}
            className="min-w-[28px] min-h-[28px] flex items-center justify-center rounded text-slate-400 hover:text-blue-300 transition-colors"
            title={providerName + (agent ? ` · ${agent.name}` : '')}
            aria-label="Edit"
          >
            <Pencil width={14} height={14} />
          </button>
          {/* 삭제 = 학습 취소 (빨간색), 클릭 전파 차단으로 부모가 가로채지 않도록 */}
          {canUnlearn && (
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onUnlearn();
              }}
              disabled={isUnlearning}
              className="min-w-[28px] min-h-[28px] flex items-center justify-center rounded text-rose-400 hover:text-rose-300 transition-colors disabled:opacity-50 skill-unlearn-btn"
              title={isUnlearning ? 'Unlearning...' : 'Unlearn'}
              aria-label={isUnlearning ? 'Unlearning...' : 'Unlearn'}
            >
              <Trash2 width={14} height={14} />
            </button>
          )}
        </div>
      </div>
      {error && <div className="mt-1 break-words text-[10px] text-rose-300">{error}</div>}
    </div>
  );
}

// Re-export for convenience
export { providerLabel };
