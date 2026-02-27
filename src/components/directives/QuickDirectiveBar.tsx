import { useState, useCallback } from "react";
import { useI18n } from "../../i18n";
import { Send } from "lucide-react";

interface QuickDirectiveBarProps {
  onSubmit: (title: string) => void;
}

export default function QuickDirectiveBar({ onSubmit }: QuickDirectiveBarProps) {
  const { t } = useI18n();
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);

  const handleSubmit = useCallback(() => {
    const trimmed = text.trim();
    if (!trimmed || busy) return;
    setBusy(true);
    onSubmit(trimmed);
    setText("");
    setBusy(false);
  }, [text, busy, onSubmit]);

  return (
    <div
      className="flex items-center gap-2 rounded-lg px-3 py-2"
      style={{
        background: "var(--th-bg-surface)",
        border: "1px solid var(--th-border)",
      }}
    >
      <span className="text-xs font-mono shrink-0" style={{ color: "var(--th-text-accent)" }}>$</span>
      <input
        type="text"
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => { if (e.key === "Enter") handleSubmit(); }}
        placeholder={t({ ko: "빠른 업무지시 입력...", en: "Quick directive..." })}
        className="flex-1 bg-transparent text-sm outline-none"
        style={{ color: "var(--th-text-primary)" }}
      />
      <button
        onClick={handleSubmit}
        disabled={!text.trim() || busy}
        className="p-1.5 rounded-md transition-colors disabled:opacity-30"
        style={{ color: "var(--th-text-accent)" }}
      >
        <Send width={14} height={14} />
      </button>
    </div>
  );
}
