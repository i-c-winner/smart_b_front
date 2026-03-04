"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { FormEvent, useEffect, useMemo, useState } from "react";

import {
  assignScheduleUserRole,
  assignTaskUserRole,
  clearProjectAdmin,
  createSchedule,
  createTask,
  getProject,
  getProjectUsers,
  getScheduleByProject,
  getTasksByProject,
  getUsers
} from "@/shared/api/domain-api";
import { useAuth } from "@/shared/lib/auth/auth-context";
import { prepareUsersForDisplay } from "@/shared/lib/users/prepare-users-for-display";
import type { Schedule, Task, User } from "@/shared/types/domain";

export function ProjectSettingsPage() {
  const router = useRouter();
  const params = useParams<{ project: string }>();
  const { token, loading } = useAuth();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [companyUsers, setCompanyUsers] = useState<User[]>([]);
  const [projectManagers, setProjectManagers] = useState<Array<{ id: number; full_name: string; email: string }>>([]);
  const [selectedTaskManagerByTask, setSelectedTaskManagerByTask] = useState<Record<number, string>>({});
  const [selectedScheduleManagerBySchedule, setSelectedScheduleManagerBySchedule] = useState<Record<number, string>>({});
  const [taskTitle, setTaskTitle] = useState("");
  const [taskDescription, setTaskDescription] = useState("");
  const [scheduleTitle, setScheduleTitle] = useState("");
  const [scheduleDescription, setScheduleDescription] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [dataLoading, setDataLoading] = useState(false);
  const [submittingTask, setSubmittingTask] = useState(false);
  const [submittingSchedule, setSubmittingSchedule] = useState(false);
  const [removingManagerId, setRemovingManagerId] = useState<number | null>(null);
  const [assigningContextKey, setAssigningContextKey] = useState<string | null>(null);

  const projectParam = params?.project ?? "";
  const projectId = useMemo(() => Number(projectParam), [projectParam]);
  const displayCompanyUsers = useMemo(() => prepareUsersForDisplay(companyUsers), [companyUsers]);

  useEffect(() => {
    if (!loading && !token) {
      router.replace("/login");
    }
  }, [loading, token, router]);

  useEffect(() => {
    if (!token || Number.isNaN(projectId)) {
      return;
    }

    let active = true;
    const fetchData = async () => {
      setDataLoading(true);
      setError(null);
      try {
        const [projectData, tasksData, scheduleData, projectUsers] = await Promise.all([
          getProject(token, projectId),
          getTasksByProject(token, projectId),
          getScheduleByProject(token, projectId),
          getProjectUsers(token, projectId)
        ]);
        const companyUsersData = await getUsers(token, projectData.company_id);
        if (!active) return;
        const safeTasks = Array.isArray(tasksData) ? tasksData : [];
        const safeSchedules = Array.isArray(scheduleData) ? scheduleData : [];
        const managers = (Array.isArray(projectUsers) ? projectUsers : [])
          .filter((item) => item.role === "project_manager")
          .map((item) => ({ id: item.id, full_name: item.full_name, email: item.email }));
        setCompanyUsers(companyUsersData);
        setTasks(safeTasks);
        setSchedules(safeSchedules);
        setProjectManagers(managers);
      } catch (err) {
        if (!active) return;
        setError(err instanceof Error ? err.message : "Cannot load project data");
      } finally {
        if (active) {
          setDataLoading(false);
        }
      }
    };

    fetchData();

    return () => {
      active = false;
    };
  }, [token, projectId]);

  const onCreateTask = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!token) return;
    setSubmittingTask(true);
    setError(null);
    try {
      const created = await createTask(token, {
        project_id: projectId,
        title: taskTitle,
        description: taskDescription || null
      });
      const updatedTasks = [created, ...tasks];
      setTasks(updatedTasks);
      setTaskTitle("");
      setTaskDescription("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Cannot create task");
    } finally {
      setSubmittingTask(false);
    }
  };

  const onCreateSchedule = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!token) return;
    setSubmittingSchedule(true);
    setError(null);
    try {
      const created = await createSchedule(token, {
        project_id: projectId,
        title: scheduleTitle,
        description: scheduleDescription || null
      });
      const updatedSchedules = [created, ...schedules];
      setSchedules(updatedSchedules);
      setScheduleTitle("");
      setScheduleDescription("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Cannot create schedule");
    } finally {
      setSubmittingSchedule(false);
    }
  };

  const onRemoveManager = async (userId: number) => {
    if (!token) return;
    setRemovingManagerId(userId);
    setError(null);
    try {
      await clearProjectAdmin(token, projectId, userId);
      setProjectManagers((prev) => prev.filter((item) => item.id !== userId));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Cannot remove manager role");
    } finally {
      setRemovingManagerId(null);
    }
  };

  const onAssignTaskManager = async (taskId: number) => {
    if (!token) return;
    const userId = Number(selectedTaskManagerByTask[taskId]);
    if (!userId) return;
    const key = `task-${taskId}`;
    setAssigningContextKey(key);
    setError(null);
    try {
      await assignTaskUserRole(token, taskId, { user_id: userId, role: "task_manager" });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Cannot assign task manager");
    } finally {
      setAssigningContextKey(null);
    }
  };

  const onAssignScheduleManager = async (scheduleId: number) => {
    if (!token) return;
    const userId = Number(selectedScheduleManagerBySchedule[scheduleId]);
    if (!userId) return;
    const key = `schedule-${scheduleId}`;
    setAssigningContextKey(key);
    setError(null);
    try {
      await assignScheduleUserRole(token, scheduleId, { user_id: userId, role: "schedule_manager" });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Cannot assign schedule manager");
    } finally {
      setAssigningContextKey(null);
    }
  };

  return (
    <main>
      <h1>Project Settings: {projectParam}</h1>
      <p>
        <Link href="/settings">Back to settings</Link>
      </p>
      {(loading || dataLoading) && <div className="card">Loading project data...</div>}
      {error && <div className="card error">{error}</div>}

      {!dataLoading && !error && (
        <>
          <section className="card">
            <h2>Project Managers</h2>
            {projectManagers.length ? (
              <ul className="list">
                {projectManagers.map((manager) => (
                  <li
                    key={manager.id}
                    style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}
                  >
                    <div>
                      <strong>{manager.full_name}</strong> ({manager.email})
                    </div>
                    <button
                      className="secondary"
                      type="button"
                      onClick={() => onRemoveManager(manager.id)}
                      disabled={removingManagerId === manager.id}
                    >
                      {removingManagerId === manager.id ? "Removing..." : "Remove role"}
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <p>No project managers.</p>
            )}
          </section>

          <section className="card">
            <h2>Task</h2>
            {tasks.length > 0 ? (
              <ul className="projects-grid">
                {tasks.map((task) => (
                  <li key={task.id}>
                    <div className="project-card-link" style={{ cursor: "default" }}>
                      <Link href={`/settings/projects/${projectId}/tasks/${task.id}`} style={{ textDecoration: "none", color: "inherit", display: "block" }}>
                        <strong>{task.title}</strong>
                        <div>{task.description || "No description"}</div>
                        <small>id: {task.id}</small>
                      </Link>
                      <div className="project-admin-row" style={{ marginTop: 10 }}>
                        <select
                          value={selectedTaskManagerByTask[task.id] ?? ""}
                          onChange={(e) =>
                            setSelectedTaskManagerByTask((prev) => ({
                              ...prev,
                              [task.id]: e.target.value
                            }))
                          }
                        >
                          <option value="">Select company user</option>
                          {displayCompanyUsers.map((user) => (
                            <option key={user.id} value={String(user.id)}>
                              {user.full_name}
                            </option>
                          ))}
                        </select>
                        <button
                          className="secondary"
                          type="button"
                          disabled={!selectedTaskManagerByTask[task.id] || assigningContextKey === `task-${task.id}`}
                          onClick={() => onAssignTaskManager(task.id)}
                        >
                          {assigningContextKey === `task-${task.id}` ? "Assigning..." : "Assign task manager"}
                        </button>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <p>No tasks yet.</p>
            )}
            <form onSubmit={onCreateTask}>
              <label>
                Title
                <input value={taskTitle} onChange={(e) => setTaskTitle(e.target.value)} required />
              </label>
              <label>
                Description
                <input value={taskDescription} onChange={(e) => setTaskDescription(e.target.value)} />
              </label>
              <button className="primary" type="submit" disabled={submittingTask}>
                {submittingTask ? "Creating..." : "Add task"}
              </button>
            </form>
          </section>

          <section className="card">
            <h2>Schedule</h2>
            {schedules.length > 0 ? (
              <ul className="projects-grid">
                {schedules.map((schedule) => (
                  <li key={schedule.id}>
                    <div className="project-card-link" style={{ cursor: "default" }}>
                      <Link
                        href={`/settings/projects/${projectId}/schedules/${schedule.id}`}
                        style={{ textDecoration: "none", color: "inherit", display: "block" }}
                      >
                        <strong>{schedule.title}</strong>
                        <div>{schedule.description || "No description"}</div>
                        <small>id: {schedule.id}</small>
                      </Link>
                      <div className="project-admin-row" style={{ marginTop: 10 }}>
                        <select
                          value={selectedScheduleManagerBySchedule[schedule.id] ?? ""}
                          onChange={(e) =>
                            setSelectedScheduleManagerBySchedule((prev) => ({
                              ...prev,
                              [schedule.id]: e.target.value
                            }))
                          }
                        >
                          <option value="">Select company user</option>
                          {displayCompanyUsers.map((user) => (
                            <option key={user.id} value={String(user.id)}>
                              {user.full_name}
                            </option>
                          ))}
                        </select>
                        <button
                          className="secondary"
                          type="button"
                          disabled={
                            !selectedScheduleManagerBySchedule[schedule.id] ||
                            assigningContextKey === `schedule-${schedule.id}`
                          }
                          onClick={() => onAssignScheduleManager(schedule.id)}
                        >
                          {assigningContextKey === `schedule-${schedule.id}`
                            ? "Assigning..."
                            : "Assign schedule manager"}
                        </button>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <p>No schedules yet.</p>
            )}
            <form onSubmit={onCreateSchedule}>
              <label>
                Title
                <input value={scheduleTitle} onChange={(e) => setScheduleTitle(e.target.value)} required />
              </label>
              <label>
                Description
                <input value={scheduleDescription} onChange={(e) => setScheduleDescription(e.target.value)} />
              </label>
              <button className="primary" type="submit" disabled={submittingSchedule}>
                {submittingSchedule ? "Creating..." : "Add schedule"}
              </button>
            </form>
          </section>
        </>
      )}
    </main>
  );
}

