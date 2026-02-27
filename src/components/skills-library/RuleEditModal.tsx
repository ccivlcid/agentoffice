import { useState, useEffect } from "react";
import { X, Plus, Minus } from "lucide-react";
import type { ProjectRule } from "../../api";
import type { TFunction } from "./skillsLibraryHelpers";

const PROVIDER_OPTIONS = ["claude", "cursor", "codex", "gemini", "opencode"];
const CATEGORY_OPTIONS = ["general", "coding", "architecture", "testing", "style"];
const CATEGORY_LABEL: Record<string, string> = {
  general: "일반 (General)",
  coding: "코딩 (Coding)",
  architecture: "아키텍처 (Architecture)",
  testing: "테스팅 (Testing)",
  style: "스타일 (Style)",
};

interface RuleEditModalProps {
  rule?: ProjectRule | null;
  submitting: boolean;
  t: TFunction;
  onClose: () => void;
  onSave: (data: Record<string, unknown>) => void;
}

export default function RuleEditModal({ rule, submitting, t, onClose, onSave }: RuleEditModalProps) {
  const isEdit = Boolean(rule);
  const [name, setName] = useState(rule?.name ?? "");
  const [title, setTitle] = useState(rule?.title ?? "");
  const [description, setDescription] = useState(rule?.description ?? "");
  const [content, setContent] = useState(rule?.content ?? "");
  const [category, setCategory] = useState(rule?.category ?? "general");
  const [globs, setGlobs] = useState<string[]>(() => {
    try { return rule?.globs ? JSON.parse(rule.globs) : []; } catch { return []; }
  });
  const [alwaysApply, setAlwaysApply] = useState(Boolean(rule?.always_apply));
  const [providers, setProviders] = useState<string[]>(() => {
    try { return rule?.providers ? JSON.parse(rule.providers) : ["claude", "cursor"]; } catch { return ["claude", "cursor"]; }
  });

  useEffect(() => {
    if (!isEdit && title && !name) {
      setName(title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/-+$/, ""));
    }
  }, [title, isEdit, name]);

  const handleSubmit = () => {
    onSave({
      name: name.trim(),
      title: title.trim(),
      description: description.trim(),
      content,
      category,
      globs,
      always_apply: alwaysApply,
      providers,
    });
  };

  const toggleProvider = (p: string) => {
    setProviders((prev) => prev.includes(p) ? prev.filter((x) => x !== p) : [...prev, p]);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="w-[calc(100vw-2rem)] max-w-2xl max-h-[85vh] overflow-y-auto rounded-2xl border border-slate-700 bg-slate-800 shadow-2xl p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold text-white">
            {isEdit ? t({ ko: "룰 편집", en: "Edit Rule" }) : t({ ko: "룰 추가", en: "Add Rule" })}
          </h3>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-700 text-slate-400">
            <X width={18} height={18} />
          </button>
        </div>

        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <Field label={t({ ko: "제목", en: "Title" })} value={title} onChange={setTitle} placeholder="Clean Code Guidelines" />
            <Field label={t({ ko: "이름 (파일명)", en: "Name (filename)" })} value={name} onChange={setName} placeholder="clean-code" mono />
          </div>

          <Field label={t({ ko: "설명", en: "Description" })} value={description} onChange={setDescription} placeholder={t({ ko: "이 룰이 무엇을 하는지 간략히", en: "Brief description of what this rule does" })} />

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-slate-400 mb-1 block">{t({ ko: "카테고리", en: "Category" })}</label>
              <select value={category} onChange={(e) => setCategory(e.target.value)}
                className="w-full bg-slate-900/60 border border-slate-600/50 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500/50">
                {CATEGORY_OPTIONS.map((c) => <option key={c} value={c}>{CATEGORY_LABEL[c] || c}</option>)}
              </select>
            </div>
            <div className="flex items-end">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={alwaysApply} onChange={(e) => setAlwaysApply(e.target.checked)}
                  className="rounded border-slate-600 bg-slate-900 text-blue-500 focus:ring-blue-500/50" />
                <span className="text-xs text-slate-400">{t({ ko: "항상 적용 (alwaysApply)", en: "Always Apply" })}</span>
              </label>
            </div>
          </div>

          {/* Globs */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs text-slate-400">{t({ ko: "적용 파일 패턴 (globs)", en: "File patterns (globs)" })}</label>
              <button onClick={() => setGlobs([...globs, ""])} className="text-blue-400 hover:text-blue-300">
                <Plus width={14} height={14} />
              </button>
            </div>
            {globs.map((g, i) => (
              <div key={i} className="flex gap-1 mb-1">
                <input value={g} onChange={(e) => { const n = [...globs]; n[i] = e.target.value; setGlobs(n); }}
                  placeholder="src/**/*.tsx"
                  className="flex-1 bg-slate-900/60 border border-slate-600/50 rounded-lg px-3 py-1.5 text-xs text-white font-mono focus:outline-none focus:border-blue-500/50" />
                <button onClick={() => setGlobs(globs.filter((_, j) => j !== i))} className="text-slate-500 hover:text-rose-400 p-1">
                  <Minus width={14} height={14} />
                </button>
              </div>
            ))}
          </div>

          {/* Providers */}
          <div>
            <label className="text-xs text-slate-400 mb-1 block">{t({ ko: "적용 프로바이더", en: "Providers" })}</label>
            <div className="flex flex-wrap gap-2">
              {PROVIDER_OPTIONS.map((p) => (
                <button key={p} onClick={() => toggleProvider(p)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-medium border transition-colors ${
                    providers.includes(p)
                      ? "bg-blue-600/20 text-blue-400 border-blue-500/40"
                      : "bg-slate-800/40 text-slate-500 border-slate-700/50"
                  }`}>
                  {p}
                </button>
              ))}
            </div>
          </div>

          {/* Content */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs text-slate-400">{t({ ko: "룰 내용 (Markdown)", en: "Rule Content (Markdown)" })}</label>
              <span className="text-[10px] text-slate-600">{content.length} chars</span>
            </div>
            <textarea value={content} onChange={(e) => setContent(e.target.value)} rows={12}
              placeholder={t({ ko: "# 룰 제목\n\n- 규칙 1\n- 규칙 2", en: "# Rule Title\n\n- Rule 1\n- Rule 2" })}
              className="w-full bg-slate-900/60 border border-slate-600/50 rounded-lg px-3 py-2 text-sm text-white font-mono focus:outline-none focus:border-blue-500/50 resize-y min-h-[120px]" />
          </div>
        </div>

        <div className="flex justify-end gap-2 mt-5 pt-4 border-t border-slate-700/50">
          <button onClick={onClose} className="px-4 py-2 text-sm text-slate-400 hover:text-white transition-colors">
            {t({ ko: "취소", en: "Cancel" })}
          </button>
          <button onClick={handleSubmit} disabled={submitting || !name.trim()}
            className="px-4 py-2 text-sm font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-500 disabled:opacity-50 transition-colors">
            {submitting ? "..." : isEdit ? t({ ko: "저장", en: "Save" }) : t({ ko: "추가", en: "Add" })}
          </button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, value, onChange, placeholder, mono }: {
  label: string; value: string; onChange: (v: string) => void; placeholder?: string; mono?: boolean;
}) {
  return (
    <div>
      <label className="text-xs text-slate-400 mb-1 block">{label}</label>
      <input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder}
        className={`w-full bg-slate-900/60 border border-slate-600/50 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500/50 ${mono ? "font-mono" : ""}`} />
    </div>
  );
}
