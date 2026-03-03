import { useState, useEffect } from "react";
import { useI18n } from "../../i18n";
import * as api from "../../api";
import { FileDown, ExternalLink, FileText, Image, Film, Archive, Table } from "lucide-react";

interface DeliverableFilesTabProps {
  taskId: string;
}

const EXT_ICONS: Record<string, React.ReactNode> = {
  ".pptx": <FileText width={14} height={14} className="text-orange-400" />,
  ".pdf": <FileText width={14} height={14} className="text-red-400" />,
  ".html": <FileText width={14} height={14} className="text-blue-400" />,
  ".md": <FileText width={14} height={14} className="text-slate-400" />,
  ".png": <Image width={14} height={14} className="text-green-400" />,
  ".jpg": <Image width={14} height={14} className="text-green-400" />,
  ".jpeg": <Image width={14} height={14} className="text-green-400" />,
  ".mp4": <Film width={14} height={14} className="text-purple-400" />,
  ".zip": <Archive width={14} height={14} className="text-yellow-400" />,
  ".csv": <Table width={14} height={14} className="text-teal-400" />,
  ".xlsx": <Table width={14} height={14} className="text-green-500" />,
};

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatTime(ts: number): string {
  return new Date(ts).toLocaleString();
}

export default function DeliverableFilesTab({ taskId }: DeliverableFilesTabProps) {
  const { t } = useI18n();
  const [files, setFiles] = useState<api.DeliverableFile[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    api.getTaskDeliverables(taskId)
      .then(setFiles)
      .catch(() => setFiles([]))
      .finally(() => setLoading(false));
  }, [taskId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12" style={{ color: "var(--th-text-muted)" }}>
        <span className="animate-pulse">{t({ ko: "산출물 검색 중...", en: "Scanning deliverables..." })}</span>
      </div>
    );
  }

  if (files.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center" style={{ color: "var(--th-text-muted)" }}>
        <FileDown width={32} height={32} className="mb-3 opacity-40" />
        <p className="text-sm">{t({ ko: "산출물 파일이 없습니다", en: "No deliverable files found" })}</p>
        <p className="mt-1 text-xs opacity-60">{t({ ko: "output/, slides/, docs/reports/ 경로를 검색했습니다", en: "Searched output/, slides/, docs/reports/" })}</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="text-xs font-medium mb-3" style={{ color: "var(--th-text-secondary)" }}>
        {t({ ko: `산출물 ${files.length}건`, en: `${files.length} deliverable(s)` })}
      </div>
      {files.map((f) => {
        const openUrl = api.getDeliverableOpenUrl(f.path);
        const canPreview = [".html", ".pdf", ".png", ".jpg", ".jpeg", ".md"].includes(f.ext);
        return (
          <div
            key={f.path}
            className="flex items-center gap-3 rounded-lg border px-3 py-2.5 transition-colors"
            style={{
              borderColor: "var(--th-card-border)",
              background: "var(--th-card-bg)",
            }}
          >
            <div className="shrink-0">{EXT_ICONS[f.ext] ?? <FileDown width={14} height={14} />}</div>
            <div className="min-w-0 flex-1">
              <div className="text-sm font-medium truncate" style={{ color: "var(--th-text-primary)" }}>{f.name}</div>
              <div className="text-[10px] truncate" style={{ color: "var(--th-text-muted)" }}>
                {f.relPath} &middot; {formatSize(f.size)} &middot; {formatTime(f.modified)}
              </div>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              {canPreview && (
                <a
                  href={openUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="rounded-md p-1.5 transition-colors"
                  style={{ color: "var(--th-text-secondary)" }}
                  title={t({ ko: "미리보기", en: "Preview" })}
                >
                  <ExternalLink width={14} height={14} />
                </a>
              )}
              <a
                href={openUrl}
                download={f.name}
                className="rounded-md p-1.5 transition-colors"
                style={{ color: "var(--th-accent)" }}
                title={t({ ko: "다운로드", en: "Download" })}
              >
                <FileDown width={14} height={14} />
              </a>
            </div>
          </div>
        );
      })}
    </div>
  );
}
