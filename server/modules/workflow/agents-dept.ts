// @ts-nocheck

// ---------------------------------------------------------------------------
// Subtask department detection helpers
// ---------------------------------------------------------------------------

export function createDeptHelpers(ctx: {
  db: any;
  DEPT_KEYWORDS: Record<string, string[]>;
  detectTargetDepartments: (...args: any[]) => any;
}) {
  const { db, DEPT_KEYWORDS, detectTargetDepartments } = ctx;

  function findExplicitDepartmentByMention(text: string, parentDeptId: string | null): string | null {
    const normalized = text.toLowerCase();
    const deptRows = db.prepare(
      "SELECT id, name, name_ko FROM departments ORDER BY sort_order ASC"
    ).all() as Array<{ id: string; name: string; name_ko: string }>;

    let best: { id: string; index: number; len: number } | null = null;
    for (const dept of deptRows) {
      if (dept.id === parentDeptId) continue;
      const variants = [dept.name, dept.name_ko, dept.name_ko.replace(/팀$/, "")];
      for (const variant of variants) {
        const token = variant.trim().toLowerCase();
        if (!token) continue;
        const idx = normalized.indexOf(token);
        if (idx < 0) continue;
        if (!best || idx < best.index || (idx === best.index && token.length > best.len)) {
          best = { id: dept.id, index: idx, len: token.length };
        }
      }
    }
    return best?.id ?? null;
  }

  function analyzeSubtaskDepartment(subtaskTitle: string, parentDeptId: string | null): string | null {
    const cleaned = subtaskTitle.replace(/\[[^\]]+\]/g, " ").replace(/\s+/g, " ").trim();
    if (!cleaned) return null;

    const prefix = cleaned.includes(":") ? cleaned.split(":")[0] : cleaned;
    const explicitFromPrefix = findExplicitDepartmentByMention(prefix, parentDeptId);
    if (explicitFromPrefix) return explicitFromPrefix;

    const explicitFromWhole = findExplicitDepartmentByMention(cleaned, parentDeptId);
    if (explicitFromWhole) return explicitFromWhole;

    const foreignDepts = detectTargetDepartments(cleaned).filter((d) => d !== parentDeptId);
    if (foreignDepts.length <= 1) return foreignDepts[0] ?? null;

    const normalized = cleaned.toLowerCase();
    let bestDept: string | null = null;
    let bestScore = -1;
    let bestFirstHit = Number.MAX_SAFE_INTEGER;

    for (const deptId of foreignDepts) {
      const keywords = DEPT_KEYWORDS[deptId] ?? [];
      let score = 0;
      let firstHit = Number.MAX_SAFE_INTEGER;
      for (const keyword of keywords) {
        const token = keyword.toLowerCase();
        const idx = normalized.indexOf(token);
        if (idx < 0) continue;
        score += 1;
        if (idx < firstHit) firstHit = idx;
      }
      if (score > bestScore || (score === bestScore && firstHit < bestFirstHit)) {
        bestScore = score;
        bestFirstHit = firstHit;
        bestDept = deptId;
      }
    }

    return bestDept ?? foreignDepts[0] ?? null;
  }

  return { findExplicitDepartmentByMention, analyzeSubtaskDepartment };
}
