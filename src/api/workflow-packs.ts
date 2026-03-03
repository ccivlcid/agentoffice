import { request, post } from "./client";

export interface WorkflowPackInfo {
  key: string;
  label: string;
  nameKo: string;
  nameEn: string;
  isolated: boolean;
  enabled: boolean;
  hydrated: boolean;
  deptCount: number;
  agentCount: number;
}

export async function getWorkflowPacks(): Promise<WorkflowPackInfo[]> {
  const j = await request<{ packs: WorkflowPackInfo[] }>("/api/workflow-packs");
  return j.packs;
}

export async function hydratePack(key: string): Promise<void> {
  await post(`/api/workflow-packs/${key}/hydrate`, {});
}

export async function togglePack(key: string, enabled: boolean): Promise<void> {
  await request(`/api/workflow-packs/${key}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ enabled }),
  });
}
