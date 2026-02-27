import { useState, useCallback, useEffect } from "react";
import type { CompanySettings } from "../types";
import { useI18n } from "../i18n";
import { Building2, Send, BookOpen, LayoutDashboard, ClipboardList, FolderCheck, Settings, Plug, FileText } from "lucide-react";
import type { LucideIcon } from "lucide-react";

const SIDEBAR_COLLAPSED_KEY = "haifer_sidebar_collapsed";

function getStoredCollapsed(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === "1";
  } catch {
    return false;
  }
}

type View = "office" | "directives" | "dashboard" | "tasks" | "deliverables" | "skills" | "skills-mcp" | "skills-rules" | "settings";

interface SidebarProps {
  currentView: View;
  onChangeView: (v: View) => void;
  settings: CompanySettings;
}

const NAV_MAIN: { view: View; icon: LucideIcon }[] = [
  { view: "office", icon: Building2 },
  { view: "dashboard", icon: LayoutDashboard },
];

const NAV_LIBRARY: { view: View; icon: LucideIcon }[] = [
  { view: "skills", icon: BookOpen },
  { view: "skills-mcp", icon: Plug },
  { view: "skills-rules", icon: FileText },
];

const NAV_WORK: { view: View; icon: LucideIcon }[] = [
  { view: "directives", icon: Send },
  { view: "tasks", icon: ClipboardList },
  { view: "deliverables", icon: FolderCheck },
];

export default function Sidebar({
  currentView,
  onChangeView,
  settings,
}: SidebarProps) {
  const [collapsed, setCollapsedState] = useState(false);
  useEffect(() => {
    setCollapsedState(getStoredCollapsed());
  }, []);
  const setCollapsed = useCallback((value: boolean | ((prev: boolean) => boolean)) => {
    setCollapsedState((prev) => {
      const next = typeof value === "function" ? value(prev) : value;
      try {
        window.localStorage.setItem(SIDEBAR_COLLAPSED_KEY, next ? "1" : "0");
      } catch {
        /* ignore */
      }
      return next;
    });
  }, []);
  const { t } = useI18n();

  const tr = (ko: string, en: string, ja = en, zh = en) =>
    t({ ko, en, ja, zh });

  const navLabels: Record<View, string> = {
    office: tr("오피스", "Office", "オフィス", "办公室"),
    dashboard: tr("대시보드", "Dashboard", "ダッシュボード", "仪表盘"),
    skills: tr("스킬", "Skills", "スキル", "技能"),
    "skills-mcp": tr("MCP 서버", "MCP Servers", "MCPサーバー", "MCP服务器"),
    "skills-rules": tr("에이전트 룰", "Agent Rules", "エージェントルール", "代理规则"),
    directives: tr("업무지시", "Directives", "業務指示", "工作指示"),
    tasks: tr("업무 관리", "Tasks", "タスク管理", "任务管理"),
    deliverables: tr("결과물", "Deliverables", "成果物", "交付物"),
    settings: tr("설정", "Settings", "設定", "设置"),
  };

  return (
    <aside
      className={`flex h-full flex-col backdrop-blur-sm transition-all duration-300 ${
        collapsed ? "w-16" : "w-48"
      }`}
      style={{ background: 'var(--th-bg-sidebar)', borderRight: '1px solid var(--th-border)' }}
    >
      {/* Logo */}
      <div className="flex items-center gap-2 px-3 py-4" style={{ borderBottom: '1px solid var(--th-border)', boxShadow: '0 4px 12px rgba(59, 130, 246, 0.06)' }}>
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="flex items-center gap-2 hover:opacity-80 transition-opacity"
          aria-label={collapsed ? tr("사이드바 펼치기", "Expand sidebar") : tr("사이드바 접기", "Collapse sidebar")}
        >
          <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0 bg-blue-500/10" style={{ color: 'var(--th-text-accent)' }}>
            <Building2 width={20} height={20} />
          </div>
          {!collapsed && (
            <div className="overflow-hidden min-w-0">
              <div className="text-sm font-bold truncate" style={{ color: 'var(--th-text-heading)' }}>
                {settings.companyName}
              </div>
              <div className="text-[10px] truncate" style={{ color: 'var(--th-text-muted)' }}>
                {settings.ceoName}
              </div>
            </div>
          )}
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 py-2 space-y-0.5 px-2 overflow-y-auto">
        {NAV_MAIN.map((item) => (
          <button
            key={item.view}
            onClick={() => onChangeView(item.view)}
            className={`sidebar-nav-item ${
              currentView === item.view
                ? "active font-semibold shadow-sm shadow-blue-500/10"
                : ""
            }`}
          >
            <item.icon width={18} height={18} className="shrink-0" />
            {!collapsed && <span>{navLabels[item.view]}</span>}
          </button>
        ))}
        {!collapsed && (
          <div
            className="px-2 pt-3 pb-1 text-[10px] uppercase font-semibold tracking-wider"
            style={{ color: "var(--th-text-muted)" }}
          >
            {tr("도서관", "Library", "ライブラリ", "文档库")}
          </div>
        )}
        {NAV_LIBRARY.map((item) => (
          <button
            key={item.view}
            onClick={() => onChangeView(item.view)}
            className={`sidebar-nav-item ${
              currentView === item.view
                ? "active font-semibold shadow-sm shadow-blue-500/10"
                : ""
            }`}
          >
            <item.icon width={18} height={18} className="shrink-0" />
            {!collapsed && <span>{navLabels[item.view]}</span>}
          </button>
        ))}
        {!collapsed && (
          <div
            className="px-2 pt-3 pb-1 text-[10px] uppercase font-semibold tracking-wider"
            style={{ color: "var(--th-text-muted)" }}
          >
            {tr("업무", "Work", "業務", "工作")}
          </div>
        )}
        {NAV_WORK.map((item) => (
          <button
            key={item.view}
            onClick={() => onChangeView(item.view)}
            className={`sidebar-nav-item ${
              currentView === item.view
                ? "active font-semibold shadow-sm shadow-blue-500/10"
                : ""
            }`}
          >
            <item.icon width={18} height={18} className="shrink-0" />
            {!collapsed && <span>{navLabels[item.view]}</span>}
          </button>
        ))}
        <div className="pt-2 mt-1" style={{ borderTop: "1px solid var(--th-border)" }} />
        <button
          onClick={() => onChangeView("settings")}
          className={`sidebar-nav-item w-full ${
            currentView === "settings"
              ? "active font-semibold shadow-sm shadow-blue-500/10"
              : ""
          }`}
        >
          <Settings width={18} height={18} className="shrink-0" />
          {!collapsed && <span>{navLabels.settings}</span>}
        </button>
      </nav>
    </aside>
  );
}
