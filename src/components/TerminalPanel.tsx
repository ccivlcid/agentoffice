import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import type { Agent, MeetingMinute, Task } from '../types';
import * as api from '../api';
import AgentAvatar from './AgentAvatar';
import { useI18n } from '../i18n';
import { STATUS_BADGES, type TaskLogEntry, TERMINAL_TAIL_LINES, TERMINAL_TASK_LOG_LIMIT } from './terminal/TerminalTypes';
import TerminalProgressStrip from './terminal/TerminalProgressStrip';
import TerminalMinutesTab from './terminal/TerminalMinutesTab';

interface TerminalPanelProps {
  taskId: string;
  task: Task | undefined;
  agent: Agent | undefined;
  agents: Agent[];
  initialTab?: 'terminal' | 'minutes';
  onClose: () => void;
}

export default function TerminalPanel({ taskId, task, agent, agents, initialTab = 'terminal', onClose }: TerminalPanelProps) {
  const [text, setText] = useState('');
  const [taskLogs, setTaskLogs] = useState<TaskLogEntry[]>([]);
  const [progressHints, setProgressHints] = useState<api.TerminalProgressHintsPayload | null>(null);
  const [meetingMinutes, setMeetingMinutes] = useState<MeetingMinute[]>([]);
  const [logPath, setLogPath] = useState('');
  const [follow, setFollow] = useState(true);
  const [activeTab, setActiveTab] = useState<'terminal' | 'minutes'>(initialTab);
  const preRef = useRef<HTMLPreElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const { t, locale } = useI18n();

  const tr = (ko: string, en: string, ja = en, zh = en) => t({ ko, en, ja, zh });
  const isKorean = locale.startsWith('ko');
  const agentName = agent
    ? isKorean ? agent.name_ko || agent.name : agent.name || agent.name_ko
    : null;

  const taskLogTimeFormatter = useMemo(
    () => new Intl.DateTimeFormat(locale, { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
    [locale]
  );

  useEffect(() => { setActiveTab(initialTab); }, [initialTab, taskId]);

  const fetchTerminal = useCallback(async () => {
    try {
      const res = await api.getTerminal(taskId, TERMINAL_TAIL_LINES, true, TERMINAL_TASK_LOG_LIMIT);
      if (res.ok) {
        setLogPath(res.path);
        if (res.task_logs) {
          setTaskLogs((prev) => {
            const next = res.task_logs ?? [];
            const prevLast = prev.length > 0 ? prev[prev.length - 1].id : null;
            const nextLast = next.length > 0 ? next[next.length - 1].id : null;
            if (prev.length === next.length && prevLast === nextLast) return prev;
            return next;
          });
        }
        setProgressHints(res.progress_hints ?? null);
        if (res.exists) {
          const nextText = res.text ?? '';
          setText((prev) => (prev === nextText ? prev : nextText));
        } else {
          setText((prev) => (prev === '' ? prev : ''));
        }
      }
    } catch { /* ignore */ }
  }, [taskId]);

  const fetchMeetingMinutes = useCallback(async () => {
    try {
      const rows = await api.getTaskMeetingMinutes(taskId);
      setMeetingMinutes(rows);
    } catch { /* ignore */ }
  }, [taskId]);

  useEffect(() => {
    const fn = activeTab === 'terminal' ? fetchTerminal : fetchMeetingMinutes;
    const ms = activeTab === 'terminal' ? 1500 : 2500;
    fn();
    let timer: ReturnType<typeof setInterval>;
    function start() { timer = setInterval(fn, ms); }
    function handleVisibility() {
      clearInterval(timer);
      if (!document.hidden) { fn(); start(); }
    }
    start();
    document.addEventListener('visibilitychange', handleVisibility);
    return () => { clearInterval(timer); document.removeEventListener('visibilitychange', handleVisibility); };
  }, [activeTab, fetchTerminal, fetchMeetingMinutes]);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) { if (e.key === 'Escape') onClose(); }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  useEffect(() => {
    if (follow && containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [text, follow]);

  function handleScroll() {
    if (!containerRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = containerRef.current;
    if (scrollHeight - scrollTop - clientHeight < 50 && follow) setFollow(false);
  }

  function scrollToBottom() {
    if (containerRef.current) { containerRef.current.scrollTop = containerRef.current.scrollHeight; setFollow(true); }
  }

  const badge = STATUS_BADGES[task?.status ?? ''] ?? STATUS_BADGES.inbox;
  const badgeLabel = t(badge.label);
  const shouldShowProgressHints = activeTab === 'terminal' && Boolean(progressHints && progressHints.hints.length > 0);
  const latestHint = shouldShowProgressHints && progressHints && progressHints.hints.length > 0
    ? progressHints.hints[progressHints.hints.length - 1] : null;
  const activeToolHint = shouldShowProgressHints && progressHints
    ? [...progressHints.hints].reverse().find((h) => h.phase === 'use') ?? latestHint : null;

  return (
    <div className="terminal-panel-shell fixed inset-0 z-50 flex w-full max-w-full flex-col shadow-2xl lg:inset-y-0 lg:right-0 lg:left-auto lg:w-[560px] lg:border-l">
      {/* Header */}
      <div className="terminal-panel-header flex items-center gap-3 border-b px-4 py-3">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          {agent && <AgentAvatar agent={agent} agents={agents} size={28} />}
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold truncate" style={{ color: 'var(--th-text-heading)' }}>
                {task?.title ?? taskId}
              </h3>
              <span className={`text-[10px] px-1.5 py-0.5 rounded border ${badge.color} flex-shrink-0`}>
                {badgeLabel}
              </span>
            </div>
            {logPath && (
              <div className="text-[10px] truncate font-mono mt-0.5" style={{ color: 'var(--th-text-muted)' }}>{logPath}</div>
            )}
            <div className="mt-1 inline-flex rounded-md border overflow-hidden w-fit" style={{ borderColor: 'var(--th-border)' }}>
              {(['terminal', 'minutes'] as const).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`px-2 py-0.5 text-[10px] transition ${activeTab === tab ? 'bg-cyan-700/30 text-cyan-200' : ''}`}
                  style={activeTab !== tab ? { background: 'var(--th-bg-surface)', color: 'var(--th-text-secondary)' } : undefined}
                >
                  {tab === 'terminal' ? tr('터미널', 'Terminal', 'ターミナル', '终端') : tr('회의록', 'Minutes', '会議録', '会议纪要')}
                </button>
              ))}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-1.5 flex-shrink-0">
          <button
            onClick={() => setFollow(f => !f)}
            className={`px-2 py-1 text-[10px] rounded border transition ${follow ? 'bg-green-500/20 text-green-400 border-green-500/40' : ''}`}
            style={!follow ? { background: 'var(--th-bg-surface)', color: 'var(--th-text-secondary)', borderColor: 'var(--th-border)' } : undefined}
          >
            {follow ? tr('따라가기', 'FOLLOW', '追従中', '跟随中') : tr('일시정지', 'PAUSED', '一時停止', '已暂停')}
          </button>
          <button onClick={scrollToBottom} className="p-1.5 rounded transition" style={{ color: 'var(--th-text-secondary)' }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 5v14M5 12l7 7 7-7" />
            </svg>
          </button>
          <button onClick={onClose} className="p-1.5 rounded transition" style={{ color: 'var(--th-text-secondary)' }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>

      {/* Task log markers */}
      {activeTab === 'terminal' && taskLogs.length > 0 && (
        <div className="terminal-panel-strip max-h-24 space-y-0.5 overflow-y-auto border-b px-4 py-2">
          {taskLogs.map(log => {
            const kindColor = log.kind === 'error' ? 'text-red-400' : log.kind === 'system' ? 'text-cyan-400' : 'text-slate-500';
            return (
              <div key={log.id} className={`text-[10px] font-mono ${kindColor}`}>
                [{taskLogTimeFormatter.format(new Date(log.created_at))}] {log.message}
              </div>
            );
          })}
        </div>
      )}

      {/* Body */}
      {activeTab === 'terminal' ? (
        <div ref={containerRef} className="flex-1 overflow-y-auto p-4" onScroll={handleScroll}>
          {!text ? (
            <div className="flex flex-col items-center justify-center h-full" style={{ color: 'var(--th-text-muted)' }}>
              <div className="text-3xl mb-3">
                {task?.status === 'in_progress' ? <span className="inline-block animate-spin">&#9881;</span> : <span>&#128421;</span>}
              </div>
              <div className="text-sm">
                {task?.status === 'in_progress'
                  ? (shouldShowProgressHints
                    ? tr('도구 실행 중...', 'Tools are running...', 'ツール実行中...', '工具正在运行...')
                    : tr('출력을 기다리는 중...', 'Waiting for output...', '出力待機中...', '正在等待输出...'))
                  : tr('아직 터미널 출력이 없습니다', 'No terminal output yet', 'まだターミナル出力がありません', '暂无终端输出')}
              </div>
            </div>
          ) : (
            <pre ref={preRef} className="text-[12px] leading-relaxed font-mono whitespace-pre-wrap break-words terminal-output-text">
              {text}
            </pre>
          )}
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto p-4">
          <TerminalMinutesTab meetingMinutes={meetingMinutes} />
        </div>
      )}

      {activeTab === 'terminal' && shouldShowProgressHints && progressHints && (
        <TerminalProgressStrip progressHints={progressHints} activeToolHint={activeToolHint} />
      )}

      {/* Footer */}
      <div className="terminal-panel-footer flex items-center justify-between border-t px-4 py-1.5 text-[10px]" style={{ color: 'var(--th-text-muted)' }}>
        <span>
          {agent ? `${agentName}` : tr('담당 에이전트 없음', 'No agent', '担当エージェントなし', '无负责人')}
          {agent?.cli_provider ? ` (${agent.cli_provider})` : ''}
        </span>
        <span>
          {task?.status === 'in_progress' && (
            <span className="inline-flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
              {activeTab === 'terminal' ? tr('실시간', 'Live', 'ライブ', '实时') : tr('회의록', 'Minutes', '会議録', '会议纪要')}
            </span>
          )}
          {task?.status === 'review' && tr('검토 중', 'Under review', 'レビュー中', '审核中')}
          {task?.status === 'done' && tr('완료됨', 'Completed', '完了', '已完成')}
        </span>
      </div>
    </div>
  );
}
