export type User = {
  id: number;
  email: string;
  full_name: string;
  is_active: boolean;
};

export type UserBrief = {
  id: number;
  email: string;
  full_name: string;
};

export type Company = {
  id: number;
  name: string;
  created_by: number;
};

export type Project = {
  id: number;
  company_id: number;
  name: string;
  created_by: number;
};

export type ProjectContextUser = {
  id: number;
  email: string;
  full_name: string;
  role: string;
};

export type ScopedUserRole = {
  id: number;
  email: string;
  full_name: string;
  role: string;
  scope_type: string;
  scope_id: number;
};

export type Task = {
  id: number;
  project_id: number;
  title: string;
  description: string | null;
  value?: Array<Record<string, string>> | null;
  created_by: number;
};

export type Schedule = {
  id: number;
  project_id: number;
  title: string;
  description: string | null;
  created_by: number;
};

export type TaskSection = {
  id: number;
  task_id: number;
  key: string;
  title: string;
  content: Record<string, unknown> | null;
  position: number;
  version: number;
  updated_by: number | null;
};

export type TaskSectionPermission = {
  id: number;
  task_section_id: number;
  user_id: number;
  role: "section_viewer" | "section_editor" | "section_manager";
  email: string;
  full_name: string;
};
