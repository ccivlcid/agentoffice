import { useState, useCallback } from 'react';
import type { TFunction } from './skillsLibraryHelpers';
import { Check } from 'lucide-react';

interface Props {
  submitting: boolean;
  t: TFunction;
  onClose: () => void;
  onUpload: (data: { name: string; content: string; provider: string }) => void;
}

export default function SkillUploadModal({ submitting, t, onClose, onUpload }: Props) {
  const [name, setName] = useState('');
  const [content, setContent] = useState('');
  const [provider, setProvider] = useState('claude');
  const [fileName, setFileName] = useState('');

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    if (!name) setName(file.name.replace(/\.md$/i, ''));
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') setContent(reader.result);
    };
    reader.readAsText(file);
  }, [name]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !content.trim() || submitting) return;
    onUpload({ name: name.trim(), content, provider });
  };

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/75 backdrop-blur-sm p-4"
      onClick={e => { if (e.target === e.currentTarget && !submitting) onClose(); }}>
      <form onSubmit={handleSubmit}
        className="w-full max-w-lg max-h-[90vh] overflow-hidden rounded-2xl border border-slate-700/60 bg-slate-900/95 shadow-2xl">
        <div className="flex items-center justify-between gap-4 border-b border-slate-700/60 px-5 py-4">
          <h3 className="text-base font-semibold text-white">
            {t({ ko: '커스텀 스킬 업로드', en: 'Upload Custom Skill' })}
          </h3>
          <button type="button" onClick={onClose} disabled={submitting}
            className="rounded-lg border border-slate-600 px-2.5 py-1 text-xs text-slate-300 hover:bg-slate-800 disabled:text-slate-600">
            {t({ ko: '닫기', en: 'Close' })}
          </button>
        </div>

        <div className="space-y-4 overflow-y-auto px-5 py-4">
          <div>
            <label className="block text-xs font-medium text-slate-300 dark:text-slate-300 mb-1.5">
              {t({ ko: '스킬 이름', en: 'Skill Name' })} *
            </label>
            <input type="text" value={name} onChange={e => setName(e.target.value)} required
              placeholder={t({ ko: '예: my-custom-skill', en: 'e.g. my-custom-skill' })}
              className="w-full bg-slate-900/60 border border-slate-600/50 rounded-lg px-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500/50" />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-300 dark:text-slate-300 mb-1.5">
              {t({ ko: '.md 파일 업로드', en: 'Upload .md File' })} *
            </label>
            <div className="flex items-center gap-2">
              <label className="cursor-pointer rounded-lg border border-dashed border-slate-600 bg-slate-800/50 px-4 py-3 text-center hover:border-blue-500/50 transition-colors flex-1">
                <input type="file" accept=".md,.markdown,.txt" onChange={handleFileChange} className="hidden" />
                <span className="text-xs text-slate-400">
                  {fileName ? fileName : t({ ko: '클릭하여 .md 파일 선택', en: 'Click to select .md file' })}
                </span>
              </label>
            </div>
            {content && (
              <p className="mt-1 text-[10px] text-emerald-400">
                <Check className="inline-block w-3.5 h-3.5 text-emerald-400 align-middle mr-0.5" /> {content.length.toLocaleString()} {t({ ko: '자 로드됨', en: 'chars loaded' })}
              </p>
            )}
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-300 dark:text-slate-300 mb-1.5">
              {t({ ko: '학습 대상 CLI', en: 'Target CLI Provider' })}
            </label>
            <select value={provider} onChange={e => setProvider(e.target.value)}
              className="w-full bg-slate-900/60 border border-slate-600/50 rounded-lg px-3 py-2.5 text-sm text-slate-300 focus:outline-none focus:border-blue-500/50">
              {['claude', 'codex', 'gemini', 'opencode', 'copilot', 'antigravity', 'api'].map(p => (
                <option key={p} value={p}>{p}</option>
              ))}
            </select>
          </div>

          {content && (
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                {t({ ko: '미리보기', en: 'Preview' })}
              </label>
              <pre className="max-h-40 overflow-y-auto rounded-lg border border-slate-700 bg-slate-950 p-3 text-[10px] text-slate-400 whitespace-pre-wrap">
                {content.slice(0, 2000)}{content.length > 2000 ? '...' : ''}
              </pre>
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2 border-t border-slate-700/60 px-5 py-3">
          <button type="button" onClick={onClose} disabled={submitting}
            className="px-3 py-1.5 rounded-lg text-xs border border-slate-600 text-slate-300 hover:bg-slate-800 disabled:text-slate-600">
            {t({ ko: '취소', en: 'Cancel' })}
          </button>
          <button type="submit" disabled={!name.trim() || !content.trim() || submitting}
            className={`px-3 py-1.5 rounded-lg text-xs border transition-all ${
              !name.trim() || !content.trim() || submitting
                ? 'cursor-not-allowed border-slate-700 text-slate-600'
                : 'border-emerald-500/50 bg-emerald-500/20 text-emerald-200 hover:bg-emerald-500/30'
            }`}>
            {submitting ? t({ ko: '업로드 중...', en: 'Uploading...' }) : t({ ko: '업로드', en: 'Upload' })}
          </button>
        </div>
      </form>
    </div>
  );
}
