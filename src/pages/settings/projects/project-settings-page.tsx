"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { FormEvent, useEffect, useMemo, useState } from "react";

import {
  createSchedule,
  createTask,
  getScheduleByProject,
  getTasksByProject
} from "@/shared/api/domain-api";
import { useAuth } from "@/shared/lib/auth/auth-context";
import type { Schedule, Task } from "@/shared/types/domain";

export function ProjectSettingsPage() {
  const router = useRouter();
  const params = useParams<{ project: string }>();
  const { token, loading } = useAuth();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [taskTitle, setTaskTitle] = useState("");
  const [taskDescription, setTaskDescription] = useState("");
  const [scheduleTitle, setScheduleTitle] = useState("");
  const [scheduleDescription, setScheduleDescription] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [dataLoading, setDataLoading] = useState(false);
  const [submittingTask, setSubmittingTask] = useState(false);
  const [submittingSchedule, setSubmittingSchedule] = useState(false);

  const projectParam = params?.project ?? "";
  const projectId = useMemo(() => Number(projectParam), [projectParam]);

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
        const [tasksData, scheduleData] = await Promise.all([
          getTasksByProject(token, projectId),
          getScheduleByProject(token, projectId)
        ]);
        if (!active) return;
        const safeTasks = Array.isArray(tasksData) ? tasksData : [];
        const safeSchedules = Array.isArray(scheduleData) ? scheduleData : [];
        setTasks(safeTasks);
        setSchedules(safeSchedules);
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
            <h2>Task</h2>
            {tasks.length > 0 ? (
              <ul className="projects-grid">
                {tasks.map((task) => (
                  <li key={task.id}>
                    <Link href={`/settings/projects/${projectId}/tasks/${task.id}`} className="project-card-link">
                      <strong>{task.title}</strong>
                      <div>{task.description || "No description"}</div>
                      <small>id: {task.id}</small>
                    </Link>
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
                    <Link
                      href={`/settings/projects/${projectId}/schedules/${schedule.id}`}
                      className="project-card-link"
                    >
                      <strong>{schedule.title}</strong>
                      <div>{schedule.description || "No description"}</div>
                      <small>id: {schedule.id}</small>
                    </Link>
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
