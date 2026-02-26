import type { Department, Agent } from '../types';
import { request, post, patch, del } from './client';

export async function getDepartments(): Promise<Department[]> {
  const j = await request<{ departments: Department[] }>('/api/departments');
  return j.departments;
}

export async function getDepartment(
  id: string,
): Promise<{ department: Department; agents: Agent[] }> {
  return request(`/api/departments/${id}`);
}

export async function createDepartment(data: {
  id: string;
  name: string;
  name_ko: string;
  name_ja?: string;
  name_zh?: string;
  icon?: string;
  color?: string;
  description?: string;
  prompt?: string;
  sort_order?: number;
}): Promise<Department> {
  const j = await post('/api/departments', data) as { ok: boolean; department: Department };
  return j.department;
}

export async function updateDepartment(
  id: string,
  data: Partial<Pick<Department, 'name' | 'name_ko' | 'name_ja' | 'name_zh' | 'icon' | 'color' | 'description' | 'prompt' | 'sort_order'>>,
): Promise<Department> {
  const j = await patch(`/api/departments/${id}`, data) as { ok: boolean; department: Department };
  return j.department;
}

export async function deleteDepartment(id: string): Promise<void> {
  await del(`/api/departments/${id}`);
}

export async function reorderDepartments(order: string[]): Promise<void> {
  await patch('/api/departments/reorder', { order });
}
