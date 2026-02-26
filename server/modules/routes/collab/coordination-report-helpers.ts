// @ts-nocheck

export const REPORT_CLAUDE_PRIORITY_DEPTS = ["planning", "dev", "design", "qa", "operations"] as const;
export const REPORT_PPT_TOOL_REPO = "https://github.com/YOUR_ORG/ppt_team_agent";
export const REPORT_PPT_TOOL_DIR = "tools/ppt_team_agent";
export const REPORT_PPT_DESIGN_SKILL = `${REPORT_PPT_TOOL_DIR}/.claude/skills/design-skill/SKILL.md`;
export const REPORT_PPT_PPTX_SKILL = `${REPORT_PPT_TOOL_DIR}/.claude/skills/pptx-skill/SKILL.md`;
export const REPORT_PPT_HTML2PPTX_SCRIPT = `${REPORT_PPT_TOOL_DIR}/.claude/skills/pptx-skill/scripts/html2pptx.js`;
export const REPORT_PPT_RESEARCH_AGENT_GUIDE = `${REPORT_PPT_TOOL_DIR}/.claude/agents/research-agent.md`;
export const REPORT_PPT_ORGANIZER_AGENT_GUIDE = `${REPORT_PPT_TOOL_DIR}/.claude/agents/organizer-agent.md`;
export const REPORT_PLAYWRIGHT_MCP_REPO = "https://github.com/microsoft/playwright-mcp.git";
export const REPORT_PLAYWRIGHT_MCP_DIR = "tools/playwright-mcp";

export const REPORT_DEPT_PRIORITY: Record<string, number> = {
  planning: 0,
  dev: 1,
  design: 2,
  qa: 3,
  operations: 4,
};

export const REPORT_DEPT_LABELS: Record<string, string> = {
  planning: "Planning",
  dev: "Development",
  design: "Design",
  qa: "QA",
  operations: "Operations",
};

export const REPORT_STATUS_PRIORITY: Record<string, number> = {
  idle: 0,
  break: 1,
  working: 2,
  offline: 3,
};

export const REPORT_ROLE_PRIORITY: Record<string, number> = {
  team_leader: 0,
  senior: 1,
  junior: 2,
  intern: 3,
};

export function initializeCollabReportHelpers(deps: {
  db: any;
}) {
  const { db } = deps;

  function stripReportRequestPrefix(content: string): string {
    return content
      .replace(/^\s*\[(보고 요청|Report Request|レポート依頼|报告请求)\]\s*/i, "")
      .trim();
  }

  type ReportOutputFormat = "ppt" | "md";

  function detectReportOutputFormat(requestText: string): ReportOutputFormat {
    const text = requestText.toLowerCase();
    const explicitMd = /(?:^|\s)(md|markdown)(?:\s|$)|마크다운|markdown 보고서|text report|텍스트 보고서|plain text|문서만|文档|テキスト/.test(text);
    if (explicitMd) return "md";
    return "ppt";
  }

  function sortReportCandidates(candidates: any[]): any[] {
    return [...candidates].sort((a, b) => {
      const ad = REPORT_DEPT_PRIORITY[a.department_id || ""] ?? 99;
      const bd = REPORT_DEPT_PRIORITY[b.department_id || ""] ?? 99;
      if (ad !== bd) return ad - bd;

      const as = REPORT_STATUS_PRIORITY[a.status || ""] ?? 99;
      const bs = REPORT_STATUS_PRIORITY[b.status || ""] ?? 99;
      if (as !== bs) return as - bs;

      const ar = REPORT_ROLE_PRIORITY[a.role || ""] ?? 99;
      const br = REPORT_ROLE_PRIORITY[b.role || ""] ?? 99;
      if (ar !== br) return ar - br;

      return a.name.localeCompare(b.name);
    });
  }

  function fetchAgentById(agentId: string | null): any | null {
    if (!agentId) return null;
    return db.prepare("SELECT * FROM agents WHERE id = ?").get(agentId) as any | null;
  }

  function fetchClaudePriorityCandidates(): any[] {
    const placeholders = REPORT_CLAUDE_PRIORITY_DEPTS.map(() => "?").join(",");
    return sortReportCandidates(
      db.prepare(`
        SELECT * FROM agents
        WHERE status != 'offline'
          AND cli_provider = 'claude'
          AND department_id IN (${placeholders})
      `).all(...REPORT_CLAUDE_PRIORITY_DEPTS) as unknown as any[],
    );
  }

  function fetchFallbackCandidates(): any[] {
    return sortReportCandidates(
      db.prepare(`
        SELECT * FROM agents
        WHERE status != 'offline'
      `).all() as unknown as any[],
    );
  }

  function pickTopRecommendationsByDept(candidates: any[]): any[] {
    const used = new Set<string>();
    const out: any[] = [];
    for (const agent of candidates) {
      const deptId = String(agent.department_id || "");
      if (!REPORT_DEPT_PRIORITY.hasOwnProperty(deptId)) continue;
      if (used.has(deptId)) continue;
      used.add(deptId);
      out.push(agent);
    }
    return out;
  }

  function formatRecommendationList(candidates: any[]): string {
    if (candidates.length === 0) return "none";
    return candidates.map((agent, idx) => {
      const deptId = String(agent.department_id || "");
      const dept = REPORT_DEPT_LABELS[deptId] || deptId || "Unknown";
      return `${idx + 1}. ${dept}:${agent.name}`;
    }).join(" / ");
  }

  function resolveReportAssignee(targetAgentId: string | null): {
    requestedAgent: any | null;
    assignee: any | null;
    claudeRecommendations: any[];
    reroutedToClaude: boolean;
    claudeUnavailable: boolean;
  } {
    const requestedAgent = fetchAgentById(targetAgentId);
    const claudeCandidates = fetchClaudePriorityCandidates();
    const claudeRecommendations = pickTopRecommendationsByDept(claudeCandidates);

    if (claudeCandidates.length > 0) {
      if (requestedAgent && requestedAgent.status !== "offline" && requestedAgent.cli_provider === "claude") {
        return {
          requestedAgent,
          assignee: requestedAgent,
          claudeRecommendations,
          reroutedToClaude: false,
          claudeUnavailable: false,
        };
      }
      return {
        requestedAgent,
        assignee: claudeRecommendations[0] ?? claudeCandidates[0] ?? null,
        claudeRecommendations,
        reroutedToClaude: Boolean(requestedAgent && requestedAgent.cli_provider !== "claude"),
        claudeUnavailable: false,
      };
    }

    const fallbackCandidates = fetchFallbackCandidates();
    const fallbackAssignee = requestedAgent && requestedAgent.status !== "offline"
      ? requestedAgent
      : (fallbackCandidates[0] ?? null);

    return {
      requestedAgent,
      assignee: fallbackAssignee,
      claudeRecommendations: [],
      reroutedToClaude: false,
      claudeUnavailable: true,
    };
  }

  function pickPlanningReportAssignee(preferredAgentId: string | null): any | null {
    return resolveReportAssignee(preferredAgentId).assignee;
  }

  return {
    stripReportRequestPrefix,
    detectReportOutputFormat,
    sortReportCandidates,
    fetchAgentById,
    fetchClaudePriorityCandidates,
    fetchFallbackCandidates,
    pickTopRecommendationsByDept,
    formatRecommendationList,
    resolveReportAssignee,
    pickPlanningReportAssignee,
  };
}
