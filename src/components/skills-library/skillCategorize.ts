export function categorize(name: string, repo: string): string {
  const n = name.toLowerCase();
  const r = repo.toLowerCase();
  if (
    n.includes("design") || n.includes("ui") || n.includes("ux") ||
    n.includes("brand") || n.includes("canvas") || n.includes("theme") ||
    n.includes("interface") || n.includes("visual") || n.includes("interaction")
  ) return "Design";
  if (
    n.includes("marketing") || n.includes("seo") || n.includes("copywriting") ||
    n.includes("content") || n.includes("social") || n.includes("pricing") ||
    n.includes("launch") || n.includes("analytics") || n.includes("cro") ||
    n.includes("ads") || n.includes("email-sequence") || n.includes("referral") ||
    n.includes("competitor") || n.includes("onboarding") || n.includes("signup") ||
    n.includes("paywall") || n.includes("popup") || n.includes("ab-test") ||
    n.includes("free-tool") || n.includes("backlink") || r.includes("marketingskills")
  ) return "Marketing";
  if (
    n.includes("test") || n.includes("debug") || n.includes("audit") ||
    n.includes("review") || n.includes("verification") || n.includes("e2e")
  ) return "Testing & QA";
  if (
    n.includes("react") || n.includes("vue") || n.includes("next") ||
    n.includes("expo") || n.includes("flutter") || n.includes("swift") ||
    n.includes("angular") || n.includes("tailwind") || n.includes("shadcn") ||
    n.includes("nuxt") || n.includes("vite") || n.includes("native") ||
    n.includes("responsive") || n.includes("component") || n.includes("frontend") ||
    n.includes("remotion") || n.includes("slidev") || n.includes("stitch")
  ) return "Frontend";
  if (
    n.includes("api") || n.includes("backend") || n.includes("node") ||
    n.includes("fastapi") || n.includes("nest") || n.includes("laravel") ||
    n.includes("python") || n.includes("golang") || n.includes("async") ||
    n.includes("sql") || n.includes("postgres") || n.includes("supabase") ||
    n.includes("convex") || n.includes("stripe") || n.includes("auth") ||
    n.includes("microservices") || n.includes("error-handling")
  ) return "Backend";
  if (
    n.includes("docker") || n.includes("github-actions") || n.includes("cicd") ||
    n.includes("deploy") || n.includes("monorepo") || n.includes("turborepo") ||
    n.includes("pnpm") || n.includes("uv-package") || n.includes("git") ||
    n.includes("release") || n.includes("worktree")
  ) return "DevOps";
  if (
    n.includes("agent") || n.includes("mcp") || n.includes("prompt") ||
    n.includes("langchain") || n.includes("rag") || n.includes("ai-sdk") ||
    n.includes("browser-use") || n.includes("skill-creator") || n.includes("find-skills") ||
    n.includes("remembering") || n.includes("subagent") || n.includes("dispatching") ||
    n.includes("planning") || n.includes("executing") || n.includes("writing-plans") ||
    n.includes("brainstorming") || n.includes("using-superpowers") || n.includes("finishing") ||
    n.includes("requesting") || n.includes("receiving") || n.includes("agentation") ||
    n.includes("clawdirect") || n.includes("instaclaw") || n.includes("nblm") ||
    n.includes("context7")
  ) return "AI & Agent";
  if (
    n.includes("pdf") || n.includes("pptx") || n.includes("docx") ||
    n.includes("xlsx") || n.includes("doc-coauthor") || n.includes("internal-comms") ||
    n.includes("slack") || n.includes("writing") || n.includes("copy-editing") ||
    n.includes("humanizer") || n.includes("obsidian") || n.includes("baoyu") ||
    n.includes("firecrawl") || n.includes("web-artifacts") || n.includes("comic") ||
    n.includes("image") || n.includes("infographic") || n.includes("url-to-markdown")
  ) return "Productivity";
  if (n.includes("security") || n.includes("accessibility")) return "Security";
  if (
    n.includes("typescript") || n.includes("javascript") || n.includes("architecture") ||
    n.includes("state-management") || n.includes("modern-javascript")
  ) return "Architecture";
  return "Other";
}
