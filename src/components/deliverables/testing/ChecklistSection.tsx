import { useState, useEffect, useCallback } from "react";
import { useI18n } from "../../../i18n";
import * as api from "../../../api";
import type { ChecklistItem as ChecklistItemType } from "../../../api";
import ChecklistItem from "./ChecklistItem";
import { Plus, Sparkles, Loader2 } from "lucide-react";

interface ChecklistSectionProps {
  taskId: string;
}

export default function ChecklistSection({ taskId }: ChecklistSectionProps) {
  const { t } = useI18n();
  const [items, setItems] = useState<ChecklistItemType[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [newText, setNewText] = useState("");

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    api.getChecklist(taskId).then((r) => {
      if (!cancelled) { setItems(r); setLoading(false); }
    }).catch(() => {
      if (!cancelled) setLoading(false);
    });
    return () => { cancelled = true; };
  }, [taskId]);

  const handleGenerate = useCallback(async () => {
    if (generating) return;
    setGenerating(true);
    try {
      const r = await api.generateChecklist(taskId);
      setItems(r);
    } catch { /* ignore */ }
    setGenerating(false);
  }, [taskId, generating]);

  const handleAdd = useCallback(async () => {
    if (!newText.trim()) return;
    try {
      const item = await api.addChecklistItem(taskId, newText.trim());
      setItems((prev) => [...prev, item]);
      setNewText("");
    } catch { /* ignore */ }
  }, [taskId, newText]);

  const handleToggle = useCallback(async (itemId: string, checked: boolean) => {
    try {
      const updated = await api.updateChecklistItem(taskId, itemId, { checked: checked ? 1 : 0 });
      setItems((prev) => prev.map((i) => (i.id === itemId ? updated : i)));
    } catch { /* ignore */ }
  }, [taskId]);

  const handleDelete = useCallback(async (itemId: string) => {
    try {
      await api.deleteChecklistItem(taskId, itemId);
      setItems((prev) => prev.filter((i) => i.id !== itemId));
    } catch { /* ignore */ }
  }, [taskId]);

  const checkedCount = items.filter((i) => i.checked).length;
  const progress = items.length > 0 ? (checkedCount / items.length) * 100 : 0;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="text-xs font-medium" style={{ color: "var(--th-text-heading)" }}>
          {t({ ko: "체크리스트", en: "Checklist" })}
          {items.length > 0 && (
            <span className="ml-1" style={{ color: "var(--th-text-muted)" }}>
              ({checkedCount}/{items.length})
            </span>
          )}
        </h4>
        <button
          onClick={handleGenerate}
          disabled={generating}
          className="flex items-center gap-1 text-[10px] px-2 py-1 rounded"
          style={{ border: "1px solid var(--th-border)", color: "var(--th-text-accent)" }}
        >
          {generating ? <Loader2 width={10} height={10} className="animate-spin" /> : <Sparkles width={10} height={10} />}
          {t({ ko: "AI 생성", en: "AI Generate" })}
        </button>
      </div>

      {/* Progress */}
      {items.length > 0 && (
        <div className="h-1 rounded-full overflow-hidden" style={{ background: "var(--th-border)" }}>
          <div
            className="h-full rounded-full bg-green-500 transition-all"
            style={{ width: `${progress}%` }}
          />
        </div>
      )}

      {/* Items */}
      {loading ? (
        <div className="flex items-center gap-2 py-4 justify-center text-xs" style={{ color: "var(--th-text-muted)" }}>
          <Loader2 width={14} height={14} className="animate-spin" />
        </div>
      ) : (
        <div className="space-y-1">
          {items.map((item) => (
            <ChecklistItem
              key={item.id}
              item={item}
              onToggle={handleToggle}
              onDelete={handleDelete}
            />
          ))}
        </div>
      )}

      {/* Add new */}
      <div className="flex gap-2">
        <input
          type="text"
          value={newText}
          onChange={(e) => setNewText(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") handleAdd(); }}
          placeholder={t({ ko: "항목 추가...", en: "Add item..." })}
          className="flex-1 text-[11px] px-2 py-1.5 rounded bg-transparent outline-none"
          style={{ border: "1px solid var(--th-border)", color: "var(--th-text-primary)" }}
        />
        <button
          onClick={handleAdd}
          disabled={!newText.trim()}
          className="p-1.5 rounded transition-colors disabled:opacity-30"
          style={{ color: "var(--th-text-accent)" }}
        >
          <Plus width={14} height={14} />
        </button>
      </div>
    </div>
  );
}
