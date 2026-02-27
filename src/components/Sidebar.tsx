import { useState } from "react";
import type { Department, Agent, CompanySettings } from "../types";
import { useI18n } from "../i18n";
import { Building2, Send, BookOpen, LayoutDashboard, ClipboardList, FolderCheck, Settings } from "lucide-react";
import type { LucideIcon } from "lucide-react";

type View = "office" | "directives" | "dashboard" | "tasks" | "deliverables" | "skills" | "settings";

interface SidebarProps {
  currentView: View;
  onChangeView: (v: View) => void;
  departments: Department[];
  agents: Agent[];
  settings: CompanySettings;
  connected: boolean;
}

const NAV_ITEMS: { view: View; icon: LucideIcon }[] = [
  { view: "office", icon: Building2 },
  { view: "skills", icon: BookOpen },
  { view: "dashboard", icon: LayoutDashboard },
  { view: "directives", icon: Send },
  { view: "tasks", icon: ClipboardList },
  { view: "deliverables", icon: FolderCheck },
  { view: "settings", icon: Settings },
];

export default function Sidebar({
  currentView,
  onChangeView,
  departments,
  agents,
  settings,
  connected,
}: SidebarProps) {
  const [collapsed, setCollapsed] = useState(false);
  const { t, locale } = useI18n();
  const workingCount = agents.filter((a) => a.status === "working").length;
  const totalAgents = agents.length;
  const isKorean = locale.startsWith("ko");

  const tr = (ko: string, en: string, ja = en, zh = en) =>
    t({ ko, en, ja, zh });

  const navLabels: Record<View, string> = {
    office: tr("오피스", "Office", "オフィス", "办公室"),
    directives: tr("업무지시", "Directives", "業務指示", "工作指示"),
    skills: tr("도서관", "Library", "ライブラリ", "文档库"),
    dashboard: tr("대시보드", "Dashboard", "ダッシュボード", "仪表盘"),
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
      <nav className="flex-1 py-2 space-y-0.5 px-2">
        {NAV_ITEMS.map((item) => (
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
      </nav>

      {/* Department quick stats */}
      {!collapsed && (
        <div className="px-3 py-2" style={{ borderTop: '1px solid var(--th-border)' }}>
          <div className="text-[10px] uppercase font-semibold mb-1.5 tracking-wider" style={{ color: 'var(--th-text-muted)' }}>
            {tr("부서 현황", "Department Status", "部門状況", "部门状态")}
          </div>
          {departments.map((d) => {
            const deptAgents = agents.filter(
              (a) => a.department_id === d.id
            );
            const working = deptAgents.filter(
              (a) => a.status === "working"
            ).length;
            return (
              <div
                key={d.id}
                className="flex items-center gap-1.5 rounded-md px-1.5 py-1 text-xs hover:bg-[var(--th-bg-surface-hover)] transition-colors"
                style={{ color: 'var(--th-text-secondary)' }}
              >
                <span className="w-2 h-2 rounded-full shrink-0" style={{ background: d.color || 'var(--th-text-muted)' }} />
                <span className="flex-1 truncate">
                  {isKorean ? d.name_ko || d.name : d.name || d.name_ko}
                </span>
                <span
                  className={
                    working > 0 ? "text-blue-400 font-medium" : ""
                  }
                >
                  {working}/{deptAgents.length}
                </span>
              </div>
            );
          })}
        </div>
      )}

      {/* Status bar */}
      <div className="px-3 py-2.5" style={{ borderTop: '1px solid var(--th-border)' }}>
        <div className="flex items-center gap-2">
          <div
            className={`w-2.5 h-2.5 rounded-full ${
              connected ? "bg-green-500 animate-pulse" : "bg-red-500"
            }`}
          />
          {!collapsed && (
            <div className="text-[10px]" style={{ color: 'var(--th-text-muted)' }}>
              {connected
                ? tr("연결됨", "Connected", "接続中", "已连接")
                : tr("연결 끊김", "Disconnected", "接続なし", "已断开")}{" "}
              · {workingCount}/{totalAgents}{" "}
              {tr("근무중", "working", "稼働中", "工作中")}
            </div>
          )}
        </div>
      </div>
    </aside>
  );
}
