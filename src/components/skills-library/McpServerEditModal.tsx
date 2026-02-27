import { useState, useEffect } from "react";
import { X, Plus, Minus } from "lucide-react";
import type { McpServer } from "../../api";
import type { TFunction } from "./skillsLibraryHelpers";

const PROVIDER_OPTIONS = ["claude", "cursor", "gemini", "opencode"];
const CATEGORY_OPTIONS = ["filesystem", "database", "api", "dev-tools", "registry", "other"];
const CATEGORY_LABEL: Record<string, string> = {
  filesystem: "파일시스템 (Filesystem)",
  database: "데이터베이스 (Database)",
  api: "API",
  "dev-tools": "개발도구 (Dev Tools)",
  registry: "레지스트리 (Registry)",
  other: "기타 (Other)",
};

interface McpServerEditModalProps {
  server?: McpServer | null;
  submitting: boolean;
  t: TFunction;
  onClose: () => void;
  onSave: (data: Record<string, unknown>) => void;
}

export default function McpServerEditModal({ server, submitting, t, onClose, onSave }: McpServerEditModalProps) {
  const isEdit = Boolean(server);
  const [name, setName] = useState(server?.name ?? "");
  const [serverKey, setServerKey] = useState(server?.server_key ?? "");
  const [pkg, setPkg] = useState(server?.package ?? "");
  const [command, setCommand] = useState(server?.command ?? "npx");
  const [args, setArgs] = useState<string[]>(() => {
    try { return server?.args ? JSON.parse(server.args) : []; } catch { return []; }
  });
  const [envEntries, setEnvEntries] = useState<Array<{ key: string; value: string }>>(() => {
    try {
      const obj = server?.env ? JSON.parse(server.env) : {};
      return Object.entries(obj).map(([key, value]) => ({ key, value: String(value) }));
    } catch { return []; }
  });
  const [description, setDescription] = useState(server?.description ?? "");
  const [category, setCategory] = useState(server?.category ?? "other");
  const [providers, setProviders] = useState<string[]>(() => {
    try { return server?.providers ? JSON.parse(server.providers) : ["claude", "cursor"]; } catch { return ["claude", "cursor"]; }
  });

  useEffect(() => {
    if (!isEdit && name && !serverKey) {
      setServerKey(name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/-+$/, ""));
    }
  }, [name, isEdit, serverKey]);

  const handleSubmit = () => {
    const envObj: Record<string, string> = {};
    for (const e of envEntries) { if (e.key.trim()) envObj[e.key.trim()] = e.value; }
    onSave({
      name: name.trim(),
      server_key: serverKey.trim(),
      package: pkg.trim(),
      command: command.trim(),
      args,
      env: envObj,
      description: description.trim(),
      category,
      providers,
    });
  };

  const toggleProvider = (p: string) => {
    setProviders((prev) => prev.includes(p) ? prev.filter((x) => x !== p) : [...prev, p]);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="w-[calc(100vw-2rem)] max-w-lg max-h-[85vh] overflow-y-auto rounded-2xl border border-slate-700 bg-slate-800 shadow-2xl p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold text-white">
            {isEdit ? t({ ko: "MCP 서버 편집", en: "Edit MCP Server" }) : t({ ko: "MCP 서버 추가", en: "Add MCP Server" })}
          </h3>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-700 text-slate-400">
            <X width={18} height={18} />
          </button>
        </div>

        <div className="space-y-3">
          <Field label={t({ ko: "이름", en: "Name" })} value={name} onChange={setName} placeholder="Filesystem" />
          <Field label={t({ ko: "서버 키", en: "Server Key" })} value={serverKey} onChange={setServerKey} placeholder="filesystem" mono />
          <Field label={t({ ko: "패키지", en: "Package" })} value={pkg} onChange={setPkg} placeholder="@anthropic/mcp-server-filesystem" mono />

          <div>
            <label className="text-xs text-slate-400 mb-1 block">{t({ ko: "명령어", en: "Command" })}</label>
            <select value={command} onChange={(e) => setCommand(e.target.value)}
              className="w-full bg-slate-900/60 border border-slate-600/50 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500/50">
              <option value="npx">npx</option>
              <option value="node">node</option>
              <option value="python">python</option>
              <option value="uvx">uvx</option>
            </select>
          </div>

          {/* Args */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs text-slate-400">{t({ ko: "인자", en: "Args" })}</label>
              <button onClick={() => setArgs([...args, ""])} className="text-blue-400 hover:text-blue-300">
                <Plus width={14} height={14} />
              </button>
            </div>
            {args.map((arg, i) => (
              <div key={i} className="flex gap-1 mb-1">
                <input value={arg} onChange={(e) => { const n = [...args]; n[i] = e.target.value; setArgs(n); }}
                  className="flex-1 bg-slate-900/60 border border-slate-600/50 rounded-lg px-3 py-1.5 text-xs text-white font-mono focus:outline-none focus:border-blue-500/50" />
                <button onClick={() => setArgs(args.filter((_, j) => j !== i))} className="text-slate-500 hover:text-rose-400 p-1">
                  <Minus width={14} height={14} />
                </button>
              </div>
            ))}
          </div>

          {/* Env */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs text-slate-400">{t({ ko: "환경변수", en: "Environment" })}</label>
              <button onClick={() => setEnvEntries([...envEntries, { key: "", value: "" }])} className="text-blue-400 hover:text-blue-300">
                <Plus width={14} height={14} />
              </button>
            </div>
            {envEntries.map((entry, i) => (
              <div key={i} className="flex gap-1 mb-1">
                <input value={entry.key} placeholder="KEY" onChange={(e) => { const n = [...envEntries]; n[i] = { ...n[i], key: e.target.value }; setEnvEntries(n); }}
                  className="w-1/3 bg-slate-900/60 border border-slate-600/50 rounded-lg px-2 py-1.5 text-xs text-white font-mono focus:outline-none focus:border-blue-500/50" />
                <input value={entry.value} placeholder="value" onChange={(e) => { const n = [...envEntries]; n[i] = { ...n[i], value: e.target.value }; setEnvEntries(n); }}
                  className="flex-1 bg-slate-900/60 border border-slate-600/50 rounded-lg px-2 py-1.5 text-xs text-white font-mono focus:outline-none focus:border-blue-500/50" />
                <button onClick={() => setEnvEntries(envEntries.filter((_, j) => j !== i))} className="text-slate-500 hover:text-rose-400 p-1">
                  <Minus width={14} height={14} />
                </button>
              </div>
            ))}
          </div>

          <Field label={t({ ko: "설명", en: "Description" })} value={description} onChange={setDescription} />

          <div>
            <label className="text-xs text-slate-400 mb-1 block">{t({ ko: "카테고리", en: "Category" })}</label>
            <select value={category} onChange={(e) => setCategory(e.target.value)}
              className="w-full bg-slate-900/60 border border-slate-600/50 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500/50">
              {CATEGORY_OPTIONS.map((c) => <option key={c} value={c}>{CATEGORY_LABEL[c] || c}</option>)}
            </select>
          </div>

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
        </div>

        <div className="flex justify-end gap-2 mt-5 pt-4 border-t border-slate-700/50">
          <button onClick={onClose} className="px-4 py-2 text-sm text-slate-400 hover:text-white transition-colors">
            {t({ ko: "취소", en: "Cancel" })}
          </button>
          <button onClick={handleSubmit} disabled={submitting || !name.trim() || !serverKey.trim()}
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
