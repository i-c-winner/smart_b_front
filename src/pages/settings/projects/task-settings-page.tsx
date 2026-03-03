"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { assignTaskUserRole, deleteTask, getProject, getTaskUsers, getTasksByProject, getUsers } from "@/shared/api/domain-api";
import { useAuth } from "@/shared/lib/auth/auth-context";
import { prepareUsersForDisplay } from "@/shared/lib/users/prepare-users-for-display";
import type { ScopedUserRole, Task, User } from "@/shared/types/domain";

const ROLE_OPTIONS = [
  { value: "task_viewer", label: "Task Viewer" },
  { value: "task_member", label: "Task Member" },
  { value: "task_manager", label: "Task Manager" }
] as const;

function taskRoleLabel(role: string): string {
  return role;
}

export function TaskSettingsPage() {
  const router = useRouter();
  const params = useParams<{ project: string; task: string }>();
  const { token, loading } = useAuth();
  const [task, setTask] = useState<Task | null>(null);
  const [companyUsers, setCompanyUsers] = useState<User[]>([]);
  const [taskRoles, setTaskRoles] = useState<ScopedUserRole[]>([]);
  const [selectedUserId, setSelectedUserId] = useState("");
  const [selectedRole, setSelectedRole] = useState<"task_viewer" | "task_member" | "task_manager">("task_viewer");
  const [error, setError] = useState<string | null>(null);
  const [dataLoading, setDataLoading] = useState(false);
  const [assigning, setAssigning] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const projectParam = params?.project ?? "";
  const taskParam = params?.task ?? "";
  const projectId = useMemo(() => Number(projectParam), [projectParam]);
  const taskId = useMemo(() => Number(taskParam), [taskParam]);
  const displayCompanyUsers = useMemo(() => prepareUsersForDisplay(companyUsers), [companyUsers]);
  const displayTaskRoles = useMemo(() => prepareUsersForDisplay(taskRoles), [taskRoles]);

  useEffect(() => {
    if (!loading && !token) {
      router.replace("/login");
    }
  }, [loading, token, router]);

  useEffect(() => {
    if (!token || Number.isNaN(projectId) || Number.isNaN(taskId)) return;

    let active = true;
    const fetchData = async () => {
      setDataLoading(true);
      setError(null);
      try {
        const [projectData, tasksData, rolesData] = await Promise.all([
          getProject(token, projectId),
          getTasksByProject(token, projectId),
          getTaskUsers(token, taskId)
        ]);
        const companyUsersData = await getUsers(token, projectData.company_id);
        if (!active) return;
        const found = (Array.isArray(tasksData) ? tasksData : []).find((item) => item.id === taskId) ?? null;
        setTask(found);
        setCompanyUsers(companyUsersData);
        setTaskRoles(Array.isArray(rolesData) ? rolesData : []);
      } catch (err) {
        if (!active) return;
        setError(err instanceof Error ? err.message : "Cannot load task settings");
      } finally {
        if (active) setDataLoading(false);
      }
    };

    fetchData();
    return () => {
      active = false;
    };
  }, [token, projectId, taskId]);

  const onAssignRole = async () => {
    if (!token) return;
    const userId = Number(selectedUserId);
    if (!userId) return;
    setAssigning(true);
    setError(null);
    try {
      await assignTaskUserRole(token, taskId, { user_id: userId, role: selectedRole });
      const roles = await getTaskUsers(token, taskId);
      setTaskRoles(Array.isArray(roles) ? roles : []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Cannot assign task role");
    } finally {
      setAssigning(false);
    }
  };

  const onDelete = async () => {
    if (!token) return;
    setDeleting(true);
    setError(null);
    try {
      await deleteTask(token, taskId);
      router.push(`/settings/projects/${projectId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Cannot delete task");
      setDeleting(false);
    }
  };

  return (
    <main>
      <h1>Task Settings: {taskParam}</h1>
      <p>
        <Link href={`/settings/projects/${projectId}`}>Back to project</Link>
      </p>

      {(loading || dataLoading) && <div className="card">Loading task settings...</div>}
      {error && <div className="card error">{error}</div>}

      {!dataLoading && !error && !task && <div className="card">Task not found in this project.</div>}

      {!dataLoading && !error && task && (
        <>
          <section className="card">
            <h2>Task</h2>
            <div>
              <strong>{task.title}</strong>
            </div>
            <div>{task.description || "No description"}</div>
            <small>id: {task.id}</small>
          </section>

          <section className="card">
            <h2>Assigned Roles</h2>
            {displayTaskRoles.length ? (
              <ul className="list">
                {displayTaskRoles.map((role) => (
                  <li key={`${role.id}-${role.role}`}>
                    <strong>{role.full_name}</strong> ({role.email}) -{" "}
                    <span className="badge">{taskRoleLabel(role.role)}</span>
                    <div>
                      context: <span className="badge">{role.scope_type}</span> #{role.scope_id}
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <p>No role assignments in task context.</p>
            )}
          </section>

          <section className="card">
            <h2>Assign User Role</h2>
            <div className="project-admin-row">
              <select value={selectedUserId} onChange={(e) => setSelectedUserId(e.target.value)}>
                <option value="">Select company user</option>
                {displayCompanyUsers.map((user) => (
                  <option key={user.id} value={String(user.id)}>
                    {user.full_name} ({user.email})
                  </option>
                ))}
              </select>
              <select
                value={selectedRole}
                onChange={(e) => setSelectedRole(e.target.value as "task_viewer" | "task_member" | "task_manager")}
              >
                {ROLE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              <button className="primary" type="button" disabled={!selectedUserId || assigning} onClick={onAssignRole}>
                {assigning ? "Assigning..." : "Assign role"}
              </button>
            </div>
          </section>

          <section className="card">
            <h2>Danger Zone</h2>
            <button className="secondary" type="button" onClick={onDelete} disabled={deleting}>
              {deleting ? "Deleting..." : "Delete task"}
            </button>
          </section>
        </>
      )}
    </main>
  );
}
