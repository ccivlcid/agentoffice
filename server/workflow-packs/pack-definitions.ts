/**
 * Workflow pack definitions — built-in pack catalog with department/agent seeds.
 * Each non-development pack uses isolated profile data (pack_key filter).
 */

export interface PackDeptSeed {
  id: string;
  name: string;
  name_ko: string;
  icon: string;
  color: string;
  description: string;
  sort_order: number;
}

export interface PackAgentSeed {
  id: string;
  name: string;
  name_ko: string;
  department_id: string;
  role: "team_leader" | "senior" | "junior" | "intern";
  avatar_emoji: string;
  personality: string;
  sprite_number: number;
}

export interface WorkflowPackDef {
  key: string;
  label: string;
  nameKo: string;
  nameEn: string;
  isolated: boolean;
  departments: PackDeptSeed[];
  agents: PackAgentSeed[];
}

export const WORKFLOW_PACKS: WorkflowPackDef[] = [
  {
    key: "development",
    label: "DEV",
    nameKo: "개발",
    nameEn: "Development",
    isolated: false,
    departments: [],
    agents: [],
  },
  {
    key: "report",
    label: "RPT",
    nameKo: "보고서",
    nameEn: "Report",
    isolated: true,
    departments: [
      { id: "rpt-editorial", name: "Editorial Planning", name_ko: "편집기획", icon: "📋", color: "#4A90D9", description: "Report structure and editorial planning", sort_order: 0 },
      { id: "rpt-research", name: "Research Engine", name_ko: "리서치엔진", icon: "🔍", color: "#7B68EE", description: "Data gathering and analysis", sort_order: 10 },
      { id: "rpt-design", name: "Doc Design", name_ko: "문서디자인", icon: "🎨", color: "#E67E22", description: "Document layout and visualization", sort_order: 20 },
      { id: "rpt-review", name: "Review Desk", name_ko: "리뷰데스크", icon: "✅", color: "#27AE60", description: "Quality assurance and fact checking", sort_order: 30 },
    ],
    agents: [
      { id: "rpt-a1", name: "Clara", name_ko: "클라라", department_id: "rpt-editorial", role: "team_leader", avatar_emoji: "📋", personality: "Structured editorial planner", sprite_number: 1 },
      { id: "rpt-a2", name: "Reed", name_ko: "리드", department_id: "rpt-research", role: "team_leader", avatar_emoji: "🔍", personality: "Methodical research analyst", sprite_number: 2 },
      { id: "rpt-a3", name: "Milo", name_ko: "마일로", department_id: "rpt-research", role: "senior", avatar_emoji: "📊", personality: "Data visualization expert", sprite_number: 3 },
      { id: "rpt-a4", name: "Nara", name_ko: "나라", department_id: "rpt-design", role: "team_leader", avatar_emoji: "🎨", personality: "Clean document designer", sprite_number: 4 },
      { id: "rpt-a5", name: "Kai", name_ko: "카이", department_id: "rpt-review", role: "team_leader", avatar_emoji: "✅", personality: "Thorough fact checker", sprite_number: 5 },
    ],
  },
  {
    key: "web_research_report",
    label: "WEB",
    nameKo: "웹조사",
    nameEn: "Web Research",
    isolated: true,
    departments: [
      { id: "web-strategy", name: "Research Strategy", name_ko: "리서치전략", icon: "🧭", color: "#3498DB", description: "Research planning and hypothesis", sort_order: 0 },
      { id: "web-crawler", name: "Crawler Team", name_ko: "크롤러팀", icon: "🕷️", color: "#9B59B6", description: "Web data collection and extraction", sort_order: 10 },
      { id: "web-factcheck", name: "Fact Check", name_ko: "팩트체크", icon: "🔬", color: "#E74C3C", description: "Source validation and cross-referencing", sort_order: 20 },
    ],
    agents: [
      { id: "web-a1", name: "Sage", name_ko: "세이지", department_id: "web-strategy", role: "team_leader", avatar_emoji: "🧭", personality: "Strategic research planner", sprite_number: 1 },
      { id: "web-a2", name: "Rex", name_ko: "렉스", department_id: "web-crawler", role: "team_leader", avatar_emoji: "🕷️", personality: "Efficient web crawler", sprite_number: 2 },
      { id: "web-a3", name: "Vera", name_ko: "베라", department_id: "web-factcheck", role: "team_leader", avatar_emoji: "🔬", personality: "Meticulous fact verifier", sprite_number: 3 },
    ],
  },
  {
    key: "novel",
    label: "NOV",
    nameKo: "소설",
    nameEn: "Novel",
    isolated: true,
    departments: [
      { id: "nov-world", name: "Worldbuilding", name_ko: "세계관팀", icon: "🏰", color: "#8E44AD", description: "Setting, lore, and world consistency", sort_order: 0 },
      { id: "nov-char", name: "Character Team", name_ko: "캐릭터팀", icon: "👤", color: "#2ECC71", description: "Character arcs and consistency", sort_order: 10 },
      { id: "nov-narrative", name: "Narrative Team", name_ko: "서사팀", icon: "✍️", color: "#E67E22", description: "Plot structure and prose", sort_order: 20 },
    ],
    agents: [
      { id: "nov-a1", name: "Atlas", name_ko: "아틀라스", department_id: "nov-world", role: "team_leader", avatar_emoji: "🏰", personality: "Deep worldbuilder with lore expertise", sprite_number: 1 },
      { id: "nov-a2", name: "Luna", name_ko: "루나", department_id: "nov-char", role: "team_leader", avatar_emoji: "👤", personality: "Empathetic character developer", sprite_number: 2 },
      { id: "nov-a3", name: "Quill", name_ko: "퀼", department_id: "nov-narrative", role: "team_leader", avatar_emoji: "✍️", personality: "Skilled narrative architect", sprite_number: 3 },
    ],
  },
  {
    key: "video_preprod",
    label: "VID",
    nameKo: "영상",
    nameEn: "Video Pre-prod",
    isolated: true,
    departments: [
      { id: "vid-concept", name: "Concept Team", name_ko: "컨셉팀", icon: "💡", color: "#F39C12", description: "Video concept and storyboard", sort_order: 0 },
      { id: "vid-script", name: "Script Team", name_ko: "스크립트팀", icon: "📝", color: "#3498DB", description: "Script writing and dialogue", sort_order: 10 },
      { id: "vid-shot", name: "Shot List", name_ko: "샷리스트", icon: "🎬", color: "#E74C3C", description: "Shot planning and visual direction", sort_order: 20 },
    ],
    agents: [
      { id: "vid-a1", name: "Zara", name_ko: "자라", department_id: "vid-concept", role: "team_leader", avatar_emoji: "💡", personality: "Creative concept director", sprite_number: 1 },
      { id: "vid-a2", name: "Max", name_ko: "맥스", department_id: "vid-script", role: "team_leader", avatar_emoji: "📝", personality: "Concise script writer", sprite_number: 2 },
      { id: "vid-a3", name: "Iris", name_ko: "아이리스", department_id: "vid-shot", role: "team_leader", avatar_emoji: "🎬", personality: "Visual shot planner", sprite_number: 3 },
    ],
  },
  {
    key: "roleplay",
    label: "RPG",
    nameKo: "롤플레이",
    nameEn: "Roleplay",
    isolated: true,
    departments: [
      { id: "rpg-char", name: "Character QA", name_ko: "캐릭터QA", icon: "🎭", color: "#9B59B6", description: "Character consistency and safety", sort_order: 0 },
      { id: "rpg-dialogue", name: "Dialogue Team", name_ko: "대사팀", icon: "💬", color: "#2ECC71", description: "In-character dialogue immersion", sort_order: 10 },
    ],
    agents: [
      { id: "rpg-a1", name: "Theo", name_ko: "테오", department_id: "rpg-char", role: "team_leader", avatar_emoji: "🎭", personality: "Character consistency guardian", sprite_number: 1 },
      { id: "rpg-a2", name: "Lyra", name_ko: "리라", department_id: "rpg-dialogue", role: "team_leader", avatar_emoji: "💬", personality: "Immersive dialogue writer", sprite_number: 2 },
    ],
  },
];

export function getPackByKey(key: string): WorkflowPackDef | undefined {
  return WORKFLOW_PACKS.find((p) => p.key === key);
}
