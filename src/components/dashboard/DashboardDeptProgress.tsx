import { Castle } from "lucide-react";
import type { TFunction } from "./dashboardHelpers";

type DeptData = {
  id: string;
  name: string;
  icon: string;
  done: number;
  total: number;
  ratio: number;
  color: { bar: string; badge: string };
};

interface DashboardDeptProgressProps {
  deptData: DeptData[];
  numberFormatter: Intl.NumberFormat;
  t: TFunction;
  onSelectDepartment?: (deptId: string) => void;
}

export default function DashboardDeptProgress({
  deptData,
  numberFormatter,
  t,
  onSelectDepartment,
}: DashboardDeptProgressProps) {
  if (deptData.length === 0) return null;

  return (
    <div className="game-panel p-5">
      <h2
        className="mb-4 flex items-center gap-2 text-sm font-black uppercase tracking-wider"
        style={{ color: "var(--th-text-primary)" }}
      >
        <span
          className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-500/15"
          style={{ boxShadow: "0 0 8px rgba(59,130,246,0.3)" }}
        >
          <Castle width={14} height={14} className="text-blue-400" />
        </span>
        {t({ ko: "부서 진행률", en: "DEPT. PROGRESS" })}
        <span
          className="ml-auto text-[9px] font-medium normal-case tracking-normal"
          style={{ color: "var(--th-text-muted)" }}
        >
          {t({ ko: "부서별 성과", en: "by department" })}
        </span>
      </h2>

      <div className="space-y-2.5">
        {deptData.map((dept) => (
          <article
            key={dept.id}
            role={onSelectDepartment ? "button" : undefined}
            tabIndex={onSelectDepartment ? 0 : undefined}
            onClick={onSelectDepartment ? () => onSelectDepartment(dept.id) : undefined}
            onKeyDown={
              onSelectDepartment
                ? (e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      onSelectDepartment(dept.id);
                    }
                  }
                : undefined
            }
            className={`group relative overflow-hidden rounded-xl border border-white/[0.06] bg-white/[0.02] p-3 transition-all duration-200 ${onSelectDepartment ? "cursor-pointer hover:bg-white/[0.06] hover:translate-x-1 focus:outline-none focus:ring-2 focus:ring-cyan-500/50 focus:ring-offset-2 focus:ring-offset-slate-900" : "hover:bg-white/[0.04] hover:translate-x-1"}`}
            aria-label={
              onSelectDepartment
                ? t({ ko: `오피스 뷰에서 ${dept.name} 보기`, en: `View ${dept.name} in office` })
                : undefined
            }
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <span
                  className="flex h-8 w-8 items-center justify-center rounded-lg transition-transform duration-200 group-hover:scale-110"
                  style={{ background: "var(--th-bg-surface)" }}
                >
                  <span className="h-2.5 w-2.5 rounded-full" style={{ background: "var(--th-text-secondary)" }} />
                </span>
                <span className="text-sm font-bold" style={{ color: "var(--th-text-primary)" }}>
                  {dept.name}
                </span>
              </div>
              <span className={`rounded-md border px-2 py-0.5 text-[10px] font-black ${dept.color.badge}`}>
                {dept.ratio}%
              </span>
            </div>
            <div className="mt-2.5 relative h-2 overflow-hidden rounded-full border border-white/[0.06] bg-white/[0.04]">
              <div
                className={`xp-bar-fill h-full rounded-full bg-gradient-to-r ${dept.color.bar} transition-all duration-700`}
                style={{ width: `${dept.ratio}%` }}
              />
            </div>
            <div
              className="mt-1.5 flex justify-between text-[9px] font-semibold uppercase tracking-wider"
              style={{ color: "var(--th-text-muted)" }}
            >
              <span>
                {t({ ko: "클리어", en: "cleared" })} {numberFormatter.format(dept.done)}
              </span>
              <span>
                {t({ ko: "전체", en: "total" })} {numberFormatter.format(dept.total)}
              </span>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}
