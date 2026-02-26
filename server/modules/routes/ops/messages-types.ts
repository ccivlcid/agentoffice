// @ts-nocheck

export type DecisionInboxRouteItem = {
  id: string;
  kind: "project_review_ready" | "task_timeout_resume" | "review_round_pick";
  created_at: number;
  summary: string;
  agent_id?: string | null;
  agent_name?: string | null;
  agent_name_ko?: string | null;
  agent_avatar?: string | null;
  project_id: string | null;
  project_name: string | null;
  project_path: string | null;
  task_id: string | null;
  task_title: string | null;
  meeting_id?: string | null;
  review_round?: number | null;
  options: Array<{ number: number; action: string; label: string }>;
};

export type ProjectReviewDecisionStateRow = {
  project_id: string;
  snapshot_hash: string;
  status: "collecting" | "ready" | "failed";
  planner_summary: string | null;
  planner_agent_id: string | null;
  planner_agent_name: string | null;
  created_at: number | null;
  updated_at: number | null;
};

export type ReviewRoundDecisionStateRow = {
  meeting_id: string;
  snapshot_hash: string;
  status: "collecting" | "ready" | "failed";
  planner_summary: string | null;
  planner_agent_id: string | null;
  planner_agent_name: string | null;
  created_at: number | null;
  updated_at: number | null;
};

export type PlanningLeadStateLike = {
  planner_agent_id?: string | null;
  planner_agent_name?: string | null;
};
