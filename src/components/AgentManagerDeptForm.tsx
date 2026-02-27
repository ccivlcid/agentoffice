import { useState } from "react";
import type { Department } from "../types";
import { useI18n } from "../i18n";

export default function DeptFormModal({
  dept,
  onSave,
  onCancel,
}: {
  dept: Partial<Department> | null;
  onSave: (data: Record<string, unknown>) => void;
  onCancel: () => void;
}) {
  const { t } = useI18n();
  const isEdit = !!dept?.id && !!dept?.name;
  const [id, setId] = useState(dept?.id ?? "");
  const [name, setName] = useState(dept?.name ?? "");
  const [nameKo, setNameKo] = useState(dept?.name_ko ?? "");
  const [nameJa, setNameJa] = useState(dept?.name_ja ?? "");
  const [nameZh, setNameZh] = useState(dept?.name_zh ?? "");
  const [icon, setIcon] = useState(dept?.icon ?? "folder");
  const [color, setColor] = useState(dept?.color ?? "#6B7280");
  const [description, setDescription] = useState(dept?.description ?? "");
  const [prompt, setPrompt] = useState(dept?.prompt ?? "");
  const [saving, setSaving] = useState(false);

  const handleSave = () => {
    if (!name.trim() || !nameKo.trim() || (!isEdit && !id.trim())) return;
    setSaving(true);
    onSave({
      ...(isEdit ? {} : { id: id.trim() }),
      name: name.trim(),
      name_ko: nameKo.trim(),
      name_ja: nameJa.trim() || null,
      name_zh: nameZh.trim() || null,
      icon,
      color,
      description: description.trim() || null,
      prompt: prompt.trim() || null,
    });
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50" onClick={(e) => e.target === e.currentTarget && onCancel()}>
      <div className="w-[min(480px,90vw)] max-h-[80vh] overflow-y-auto rounded-xl border border-slate-700 bg-slate-900 p-5 shadow-xl">
        <h3 className="mb-4 text-sm font-bold text-white">
          {isEdit ? t({ ko: "부서 편집", en: "Edit Department" }) : t({ ko: "새 부서 생성", en: "Create Department" })}
        </h3>
        <div className="space-y-3">
          {!isEdit && (
            <label className="block"><span className="text-xs text-slate-400">{t({ ko: "ID (a-z0-9)", en: "ID (a-z0-9)" })}</span>
              <input className="mt-1 w-full rounded border border-slate-600 bg-slate-800 px-2 py-1.5 text-xs text-white" value={id} onChange={(e) => setId(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))} /></label>
          )}
          <div className="grid grid-cols-2 gap-3">
            <label className="block"><span className="text-xs text-slate-400">{t({ ko: "이름 (EN)", en: "Name (EN)" })}</span>
              <input className="mt-1 w-full rounded border border-slate-600 bg-slate-800 px-2 py-1.5 text-xs text-white" value={name} onChange={(e) => setName(e.target.value)} /></label>
            <label className="block"><span className="text-xs text-slate-400">{t({ ko: "이름 (KO)", en: "Name (KO)" })}</span>
              <input className="mt-1 w-full rounded border border-slate-600 bg-slate-800 px-2 py-1.5 text-xs text-white" value={nameKo} onChange={(e) => setNameKo(e.target.value)} /></label>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <label className="block"><span className="text-xs text-slate-400">{t({ ko: "아이콘", en: "Icon" })}</span>
              <input className="mt-1 w-full rounded border border-slate-600 bg-slate-800 px-2 py-1.5 text-xs text-white" value={icon} onChange={(e) => setIcon(e.target.value)} /></label>
            <label className="block"><span className="text-xs text-slate-400">{t({ ko: "색상", en: "Color" })}</span>
              <input type="color" className="mt-1 h-8 w-full cursor-pointer rounded border border-slate-600 bg-slate-800" value={color} onChange={(e) => setColor(e.target.value)} /></label>
          </div>
          <label className="block"><span className="text-xs text-slate-400">{t({ ko: "설명", en: "Description" })}</span>
            <textarea className="mt-1 w-full rounded border border-slate-600 bg-slate-800 px-2 py-1.5 text-xs text-white" rows={2} value={description} onChange={(e) => setDescription(e.target.value)} /></label>
          <label className="block"><span className="text-xs text-slate-400">{t({ ko: "프롬프트", en: "Prompt" })}</span>
            <textarea className="mt-1 w-full rounded border border-slate-600 bg-slate-800 px-2 py-1.5 text-xs text-white" rows={3} value={prompt} onChange={(e) => setPrompt(e.target.value)} /></label>
        </div>
        <div className="mt-4 flex gap-2">
          <button disabled={saving || !name.trim() || !nameKo.trim()} onClick={handleSave} className="flex-1 rounded bg-blue-600 py-2 text-xs font-medium text-white hover:bg-blue-500 disabled:opacity-40">
            {saving ? "..." : isEdit ? t({ ko: "저장", en: "Save" }) : t({ ko: "생성", en: "Create" })}
          </button>
          <button onClick={onCancel} className="rounded border border-slate-700 px-4 py-2 text-xs text-slate-300">{t({ ko: "취소", en: "Cancel" })}</button>
        </div>
      </div>
    </div>
  );
}
