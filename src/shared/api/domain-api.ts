import { http } from "@/shared/api/http";
import type { Company, Project, Schedule, ScopedUserRole, Task, User } from "@/shared/types/domain";

export function getUsers(token: string, companyId?: number): Promise<User[]> {
  const suffix = companyId ? `?company_id=${companyId}` : "";
  return http<User[]>(`/users${suffix}`, undefined, token);
}

export function getCompanies(token: string): Promise<Company[]> {
  return http<Company[]>('/companies', undefined, token);
}

export function getProjects(token: string, companyId: number): Promise<Project[]> {
  return http<Project[]>(`/projects?company_id=${companyId}`, undefined, token);
}

export function getProject(token: string, projectId: number): Promise<Project> {
  return http<Project>(`/projects/${projectId}`, undefined, token);
}

export function getProjectUsers(token: string, projectId: number): Promise<Array<{ id: number; email: string; full_name: string; role: string }>> {
  return http(`/projects/${projectId}/users`, undefined, token);
}

export function getTasksByProject(token: string, projectId: number): Promise<Task[]> {
  return http(`/tasks/project/${projectId}`, undefined, token);
}

export function createTask(
  token: string,
  payload: { project_id: number; title: string; description?: string | null }
): Promise<Task> {
  return http('/tasks', { method: 'POST', body: JSON.stringify(payload) }, token);
}

export function deleteTask(token: string, taskId: number): Promise<void> {
  return http(`/tasks/${taskId}`, { method: 'DELETE' }, token);
}

export function getTaskUsers(token: string, taskId: number): Promise<ScopedUserRole[]> {
  return http(`/tasks/${taskId}/users`, undefined, token);
}

export function assignTaskUserRole(
  token: string,
  taskId: number,
  payload: { user_id: number; role: "task_viewer" | "task_member" | "task_manager" }
): Promise<ScopedUserRole> {
  return http(`/tasks/${taskId}/assign-role`, { method: "POST", body: JSON.stringify(payload) }, token);
}

export function getScheduleByProject(token: string, projectId: number): Promise<Schedule[]> {
  return http(`/schedules/project/${projectId}`, undefined, token);
}

export function createSchedule(
  token: string,
  payload: { project_id: number; title: string; description?: string | null }
): Promise<Schedule> {
  return http('/schedules', { method: 'POST', body: JSON.stringify(payload) }, token);
}

export function deleteSchedule(token: string, scheduleId: number): Promise<void> {
  return http(`/schedules/${scheduleId}`, { method: 'DELETE' }, token);
}

export function getScheduleUsers(token: string, scheduleId: number): Promise<ScopedUserRole[]> {
  return http(`/schedules/${scheduleId}/users`, undefined, token);
}

export function assignScheduleUserRole(
  token: string,
  scheduleId: number,
  payload: { user_id: number; role: "schedule_viewer" | "schedule_member" | "schedule_manager" }
): Promise<ScopedUserRole> {
  return http(`/schedules/${scheduleId}/assign-role`, { method: "POST", body: JSON.stringify(payload) }, token);
}

export function getProjectAdmins(
  token: string,
  companyId: number
): Promise<Array<{ project_id: number; admins: Array<{ id: number; email: string; full_name: string }> }>> {
  return http(`/projects/admins?company_id=${companyId}`, undefined, token);
}

export function createProject(token: string, payload: { company_id: number; name: string }): Promise<Project> {
  return http<Project>('/projects', { method: 'POST', body: JSON.stringify(payload) }, token);
}

export function createCompanyUser(
  token: string,
  payload: { company_id: number; email: string; full_name: string; password: string }
): Promise<User> {
  return http<User>('/users', { method: 'POST', body: JSON.stringify(payload) }, token);
}

export function assignProjectAdmin(token: string, projectId: number, userId: number): Promise<unknown> {
  return http(`/projects/${projectId}/assign-admin`, {
    method: 'POST',
    body: JSON.stringify({ user_id: userId })
  }, token);
}
