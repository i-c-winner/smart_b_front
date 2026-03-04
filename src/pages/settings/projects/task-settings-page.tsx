"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import {
  assignTaskSectionPermission,
  clearTaskSectionPermission,
  clearTaskUserRoles,
  createTaskSection,
  deleteTaskSection,
  deleteTask,
  getProject,
  getTaskSectionPermissions,
  getTaskSections,
  getTaskUsers,
  getTasksByProject,
  getUsers,
} from "@/shared/api/domain-api";
import { useAuth } from "@/shared/lib/auth/auth-context";
import { prepareUsersForDisplay } from "@/shared/lib/users/prepare-users-for-display";
import type { ScopedUserRole, Task, TaskSection, TaskSectionPermission, User } from "@/shared/types/domain";

const SECTION_ROLE_OPTIONS = [
  { value: "section_viewer", label: "Section Viewer" },
  { value: "section_editor", label: "Section Editor" },
  { value: "section_manager", label: "Section Manager" }
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
  const [showTaskValueForm, setShowTaskValueForm] = useState(false);
  const [sections, setSections] = useState<TaskSection[]>([]);
  const [selectedSectionId, setSelectedSectionId] = useState<string>("");
  const [sectionPermissions, setSectionPermissions] = useState<TaskSectionPermission[]>([]);
  const [savingSection, setSavingSection] = useState(false);
  const [creatingSection, setCreatingSection] = useState(false);
  const [newSectionKey, setNewSectionKey] = useState("");
  const [newSectionTitle, setNewSectionTitle] = useState("");
  const [selectedPermUserId, setSelectedPermUserId] = useState("");
  const [selectedPermRole, setSelectedPermRole] = useState<"section_viewer" | "section_editor" | "section_manager">(
    "section_editor"
  );
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
        const [projectData, tasksData, rolesData, sectionsData] = await Promise.all([
          getProject(token, projectId),
          getTasksByProject(token, projectId),
          getTaskUsers(token, taskId),
          getTaskSections(token, taskId)
        ]);
        const companyUsersData = await getUsers(token, projectData.company_id);
        if (!active) return;
        const found = (Array.isArray(tasksData) ? tasksData : []).find((item) => item.id === taskId) ?? null;
        const safeSections = Array.isArray(sectionsData) ? sectionsData : [];
        setTask(found);
        setCompanyUsers(companyUsersData);
        setTaskRoles(Array.isArray(rolesData) ? rolesData : []);
        setSections(safeSections);
        setSelectedSectionId((prev) => (prev ? prev : safeSections[0] ? String(safeSections[0].id) : ""));
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

  useEffect(() => {
    if (!token || !selectedSectionId) {
      setSectionPermissions([]);
      return;
    }

    let active = true;
    const loadPerms = async () => {
      try {
        const perms = await getTaskSectionPermissions(token, taskId, Number(selectedSectionId));
        if (!active) return;
        setSectionPermissions(Array.isArray(perms) ? perms : []);
      } catch {
        if (!active) return;
        setSectionPermissions([]);
      }
    };
    loadPerms();
    return () => {
      active = false;
    };
  }, [token, taskId, selectedSectionId, sections]);

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

  const onCreateSection = async () => {
    if (!token || !newSectionKey.trim() || !newSectionTitle.trim()) return;
    setCreatingSection(true);
    setError(null);
    try {
      const created = await createTaskSection(token, taskId, {
        key: newSectionKey.trim(),
        title: newSectionTitle.trim(),
        content: {},
        position: sections.length
      });
      const next = [...sections, created];
      setSections(next);
      setSelectedSectionId(String(created.id));
      setNewSectionKey("");
      setNewSectionTitle("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Cannot create section");
    } finally {
      setCreatingSection(false);
    }
  };

  const onDeleteSection = async () => {
    if (!token || !selectedSectionId) return;
    setSavingSection(true);
    setError(null);
    try {
      await deleteTaskSection(token, taskId, Number(selectedSectionId));
      const next = sections.filter((item) => item.id !== Number(selectedSectionId));
      setSections(next);
      setSelectedSectionId(next[0] ? String(next[0].id) : "");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Cannot delete section");
    } finally {
      setSavingSection(false);
    }
  };

  const onAssignSectionPermission = async () => {
    if (!token || !selectedSectionId || !selectedPermUserId) return;
    setSavingSection(true);
    setError(null);
    try {
      await assignTaskSectionPermission(token, taskId, Number(selectedSectionId), Number(selectedPermUserId), {
        role: selectedPermRole
      });
      const perms = await getTaskSectionPermissions(token, taskId, Number(selectedSectionId));
      setSectionPermissions(Array.isArray(perms) ? perms : []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Cannot assign section permission");
    } finally {
      setSavingSection(false);
    }
  };

  return (
    <main>
      <h1>Task Settings: {taskParam}</h1>
      <p>
        <Link href={`/settings/projects/${projectId}`}>Back to project</Link>
      </p>
      <p>
        <button className="secondary" type="button" onClick={() => setShowTaskValueForm((prev) => !prev)}>
          Настройка задания
        </button>
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

          {showTaskValueForm && (
            <section className="card">
              <h2>Документ: разделы</h2>
              <div className="grid" style={{ marginBottom: 12 }}>
                <label>
                  Section key
                  <input value={newSectionKey} onChange={(e) => setNewSectionKey(e.target.value)} />
                </label>
                <label>
                  Section title
                  <input value={newSectionTitle} onChange={(e) => setNewSectionTitle(e.target.value)} />
                </label>
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <button
                  className="secondary"
                  type="button"
                  onClick={onCreateSection}
                  disabled={creatingSection || !newSectionKey.trim() || !newSectionTitle.trim()}
                >
                  {creatingSection ? "Creating..." : "Add section"}
                </button>
              </div>

              <hr style={{ margin: "16px 0", border: 0, borderTop: "1px solid var(--border)" }} />

              <label>
                Section
                <select value={selectedSectionId} onChange={(e) => setSelectedSectionId(e.target.value)}>
                  <option value="">Select section</option>
                  {sections.map((section) => (
                    <option key={section.id} value={String(section.id)}>
                      {section.title} ({section.key})
                    </option>
                  ))}
                </select>
              </label>

              {selectedSectionId && (
                <>
                  <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                    <button className="secondary" type="button" onClick={onDeleteSection} disabled={savingSection}>
                      Delete section
                    </button>
                  </div>

                  <h3 style={{ marginTop: 16 }}>Section permissions</h3>
                  {sectionPermissions.length ? (
                    <ul className="list">
                      {sectionPermissions.map((perm) => (
                        <li
                          key={perm.id}
                          style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}
                        >
                          <div>
                            <strong>{perm.full_name}</strong> ({perm.email}) - <span className="badge">{perm.role}</span>
                          </div>
                          <button
                            className="secondary"
                            type="button"
                            disabled={savingSection}
                            onClick={async () => {
                              if (!token) return;
                              setSavingSection(true);
                              setError(null);
                              try {
                                await clearTaskSectionPermission(token, taskId, Number(selectedSectionId), perm.user_id);
                                const perms = await getTaskSectionPermissions(token, taskId, Number(selectedSectionId));
                                setSectionPermissions(Array.isArray(perms) ? perms : []);
                              } catch (err) {
                                setError(err instanceof Error ? err.message : "Cannot remove section permission");
                              } finally {
                                setSavingSection(false);
                              }
                            }}
                          >
                            Remove
                          </button>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p>No permissions yet.</p>
                  )}

                  <div className="project-admin-row" style={{ marginTop: 8 }}>
                    <select value={selectedPermUserId} onChange={(e) => setSelectedPermUserId(e.target.value)}>
                      <option value="">Select user</option>
                      {displayCompanyUsers.map((user) => (
                        <option key={user.id} value={String(user.id)}>
                          {user.full_name}
                        </option>
                      ))}
                    </select>
                    <select
                      value={selectedPermRole}
                      onChange={(e) =>
                        setSelectedPermRole(e.target.value as "section_viewer" | "section_editor" | "section_manager")
                      }
                    >
                      {SECTION_ROLE_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                    <button
                      className="primary"
                      type="button"
                      disabled={!selectedPermUserId || savingSection}
                      onClick={onAssignSectionPermission}
                    >
                      Assign
                    </button>
                  </div>
                </>
              )}
            </section>
          )}
          <section className="card">
            <h2>Assigned Roles</h2>
            {displayTaskRoles.length ? (
              <ul className="list">
                {displayTaskRoles.map((role) => (
                  <li
                    key={`${role.id}-${role.role}`}
                    style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}
                  >
                    <div>
                      <strong>{role.full_name}</strong> ({role.email}) -{" "}
                      <span className="badge">{taskRoleLabel(role.role)}</span>
                      <div>
                        context: <span className="badge">{role.scope_type}</span> #{role.scope_id}
                      </div>
                    </div>
                    <button
                      className="secondary"
                      type="button"
                      disabled={assigning}
                      onClick={async () => {
                        if (!token) return;
                        setAssigning(true);
                        setError(null);
                        try {
                          await clearTaskUserRoles(token, taskId, role.id);
                          const roles = await getTaskUsers(token, taskId);
                          setTaskRoles(Array.isArray(roles) ? roles : []);
                        } catch (err) {
                          setError(err instanceof Error ? err.message : "Cannot remove task role");
                        } finally {
                          setAssigning(false);
                        }
                      }}
                    >
                      Remove role
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <p>No role assignments in task context.</p>
            )}
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
