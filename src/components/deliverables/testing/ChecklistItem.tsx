import type { ChecklistItem as ChecklistItemType } from "../../../api";
import { Trash2 } from "lucide-react";

interface ChecklistItemProps {
  item: ChecklistItemType;
  onToggle: (id: string, checked: boolean) => void;
  onDelete: (id: string) => void;
}

export default function ChecklistItem({ item, onToggle, onDelete }: ChecklistItemProps) {
  return (
    <div
      className="flex items-start gap-2 rounded px-2 py-1.5 group"
      style={{ background: "var(--th-bg-surface)" }}
    >
      <input
        type="checkbox"
        checked={Boolean(item.checked)}
        onChange={(e) => onToggle(item.id, e.target.checked)}
        className="mt-0.5 shrink-0 accent-blue-500"
      />
      <div className="flex-1 min-w-0">
        <span
          className={`text-xs ${item.checked ? "line-through opacity-60" : ""}`}
          style={{ color: "var(--th-text-secondary)" }}
        >
          {item.text}
        </span>
        {item.category && (
          <span
            className="ml-1.5 text-[9px] px-1 rounded"
            style={{ background: "var(--th-bg-surface-hover)", color: "var(--th-text-muted)" }}
          >
            {item.category}
          </span>
        )}
      </div>
      <button
        onClick={() => onDelete(item.id)}
        className="p-0.5 opacity-0 group-hover:opacity-60 hover:opacity-100 transition-opacity"
        style={{ color: "var(--th-text-muted)" }}
      >
        <Trash2 width={12} height={12} />
      </button>
    </div>
  );
}
