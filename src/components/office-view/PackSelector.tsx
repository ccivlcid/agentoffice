import { useState, useEffect, useRef } from "react";
import * as api from "../../api";
import { useI18n } from "../../i18n";

interface PackSelectorProps {
  currentPackKey: string;
  onSelectPack: (key: string) => void;
}

export default function PackSelector({ currentPackKey, onSelectPack }: PackSelectorProps) {
  const [packs, setPacks] = useState<api.WorkflowPackInfo[]>([]);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const { t, locale } = useI18n();
  const isKo = locale.startsWith("ko");

  useEffect(() => {
    api.getWorkflowPacks().then(setPacks).catch(() => {});
  }, []);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const current = packs.find((p) => p.key === currentPackKey) ?? packs[0];
  if (packs.length <= 1) return null;

  const handleSelect = async (key: string) => {
    setOpen(false);
    const pack = packs.find((p) => p.key === key);
    if (pack && pack.isolated && !pack.hydrated) {
      try { await api.hydratePack(key); } catch { /* ignore */ }
    }
    onSelectPack(key);
  };

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs font-medium transition-colors"
        style={{
          borderColor: "var(--th-border)",
          background: "var(--th-bg-surface)",
          color: "var(--th-text-primary)",
        }}
      >
        <span className="font-bold" style={{ color: "var(--th-accent)" }}>
          {current?.label ?? "DEV"}
        </span>
        <span className="hidden sm:inline">
          {isKo ? (current?.nameKo ?? "") : (current?.nameEn ?? "")}
        </span>
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className={`transition-transform ${open ? "rotate-180" : ""}`}>
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>

      {open && (
        <div
          className="absolute left-0 top-full z-50 mt-1 min-w-[160px] rounded-lg border shadow-lg"
          style={{ background: "var(--th-panel-bg)", borderColor: "var(--th-panel-border)" }}
        >
          {packs.filter((p) => p.enabled).map((p) => (
            <button
              key={p.key}
              onClick={() => handleSelect(p.key)}
              className={`flex w-full items-center gap-2 px-3 py-2 text-xs transition-colors ${
                p.key === currentPackKey ? "font-bold" : ""
              }`}
              style={{
                color: p.key === currentPackKey ? "var(--th-accent)" : "var(--th-text-primary)",
                background: p.key === currentPackKey ? "var(--th-card-bg-hover)" : "transparent",
              }}
            >
              <span className="font-bold w-8">{p.label}</span>
              <span>{isKo ? p.nameKo : p.nameEn}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
