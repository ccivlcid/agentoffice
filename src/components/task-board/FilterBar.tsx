import type { Department } from '../../types';
import { useI18n, taskTypeLabel, TASK_TYPE_OPTIONS } from './taskBoardHelpers';
import { Search } from 'lucide-react';

export interface FilterBarProps {
  departments: Department[];
  filterDept: string;
  filterType: string;
  search: string;
  onFilterDept: (v: string) => void;
  onFilterType: (v: string) => void;
  onSearch: (v: string) => void;
}

export function FilterBar({
  departments, filterDept, filterType, search,
  onFilterDept, onFilterType, onSearch,
}: FilterBarProps) {
  const { t, locale } = useI18n();

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="relative min-w-[140px] flex-1 sm:min-w-[180px]">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" width={14} height={14} />
        <input
          type="text"
          value={search}
          onChange={(e) => onSearch(e.target.value)}
          placeholder={t({ ko: '업무 검색...', en: 'Search tasks...' })}
          className="w-full rounded-lg border border-slate-700 bg-slate-800 py-1.5 pl-8 pr-3 text-sm text-white placeholder-slate-500 outline-none transition focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
        />
      </div>

      <select
        value={filterDept}
        onChange={(e) => onFilterDept(e.target.value)}
        className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-1.5 text-sm text-slate-300 outline-none transition focus:border-blue-500"
      >
        <option value="">{t({ ko: '전체 부서', en: 'All Departments' })}</option>
        {departments.map((d) => (
          <option key={d.id} value={d.id}>
            {locale === 'ko' ? d.name_ko : d.name}
          </option>
        ))}
      </select>

      <select
        value={filterType}
        onChange={(e) => onFilterType(e.target.value)}
        className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-1.5 text-sm text-slate-300 outline-none transition focus:border-blue-500"
      >
        <option value="">{t({ ko: '전체 유형', en: 'All Types' })}</option>
        {TASK_TYPE_OPTIONS.map((typeOption) => (
          <option key={typeOption.value} value={typeOption.value}>
            {taskTypeLabel(typeOption.value, t)}
          </option>
        ))}
      </select>
    </div>
  );
}
