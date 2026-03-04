"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import {
  getCompanies,
  getCompany,
  getProject,
  getProjects,
  getSchedule,
  getScheduleByProject,
  getTask,
  getTaskSections,
  getTasksByProject,
  getUsers,
  updateTaskSection
} from "@/shared/api/domain-api";
import { useAuth } from "@/shared/lib/auth/auth-context";
import type { Company, Project, Schedule, Task, TaskSection, User } from "@/shared/types/domain";

type NodeType = "company" | "project" | "task" | "schedule" | "user" | "section";

function isNodeType(value: string): value is NodeType {
  return (
    value === "company" ||
    value === "project" ||
    value === "task" ||
    value === "schedule" ||
    value === "user" ||
    value === "section"
  );
}

export function NodeDetailsPage() {
  const router = useRouter();
  const params = useParams<{ type: string; id: string }>();
  const { token, loading } = useAuth();

  const [company, setCompany] = useState<Company | null>(null);
  const [project, setProject] = useState<Project | null>(null);
  const [task, setTask] = useState<Task | null>(null);
  const [schedule, setSchedule] = useState<Schedule | null>(null);
  const [section, setSection] = useState<TaskSection | null>(null);
  const [taskSections, setTaskSections] = useState<TaskSection[]>([]);
  const [projectTasks, setProjectTasks] = useState<Task[]>([]);
  const [projectSchedules, setProjectSchedules] = useState<Schedule[]>([]);
  const [user, setUser] = useState<User | null>(null);
  const [sectionTextDraft, setSectionTextDraft] = useState("");
  const [savingSection, setSavingSection] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dataLoading, setDataLoading] = useState(false);

  const nodeTypeRaw = params?.type ?? "";
  const nodeId = useMemo(() => Number(params?.id ?? ""), [params?.id]);
  const nodeType = isNodeType(nodeTypeRaw) ? nodeTypeRaw : null;

  useEffect(() => {
    if (!loading && !token) {
      router.replace("/login");
    }
  }, [loading, token, router]);

  useEffect(() => {
    if (!token || !nodeType || Number.isNaN(nodeId)) return;

    let active = true;
    const load = async () => {
      setDataLoading(true);
      setError(null);
      setCompany(null);
      setProject(null);
      setTask(null);
      setSchedule(null);
      setSection(null);
      setTaskSections([]);
      setProjectTasks([]);
      setProjectSchedules([]);
      setUser(null);
      setSectionTextDraft("");
      try {
        if (nodeType === "company") {
          const companyData = await getCompany(token, nodeId);
          if (!active) return;
          setCompany(companyData);
          return;
        }

        if (nodeType === "project") {
          const [projectData, tasks, schedules] = await Promise.all([
            getProject(token, nodeId),
            getTasksByProject(token, nodeId).catch(() => []),
            getScheduleByProject(token, nodeId).catch(() => [])
          ]);
          const companyData = await getCompany(token, projectData.company_id);
          if (!active) return;
          setProject(projectData);
          setCompany(companyData);
          setProjectTasks(Array.isArray(tasks) ? tasks : []);
          setProjectSchedules(Array.isArray(schedules) ? schedules : []);
          return;
        }

        if (nodeType === "task") {
          const [taskData, sectionsData] = await Promise.all([
            getTask(token, nodeId),
            getTaskSections(token, nodeId).catch(() => [])
          ]);
          const projectData = await getProject(token, taskData.project_id);
          const companyData = await getCompany(token, projectData.company_id);
          if (!active) return;
          setTask(taskData);
          setTaskSections(Array.isArray(sectionsData) ? sectionsData : []);
          setProject(projectData);
          setCompany(companyData);
          return;
        }

        if (nodeType === "schedule") {
          const scheduleData = await getSchedule(token, nodeId);
          const projectData = await getProject(token, scheduleData.project_id);
          const companyData = await getCompany(token, projectData.company_id);
          if (!active) return;
          setSchedule(scheduleData);
          setProject(projectData);
          setCompany(companyData);
          return;
        }

        if (nodeType === "section") {
          const companies = await getCompanies(token);
          let foundSection: TaskSection | null = null;
          let foundTask: Task | null = null;
          let foundProject: Project | null = null;
          let foundCompany: Company | null = null;

          for (const companyItem of companies) {
            const projects = await getProjects(token, companyItem.id).catch(() => []);
            for (const projectItem of projects) {
              const tasks = await getTasksByProject(token, projectItem.id).catch(() => []);
              for (const taskItem of tasks) {
                const sections = await getTaskSections(token, taskItem.id).catch(() => []);
                const match = sections.find((item) => item.id === nodeId);
                if (match) {
                  foundSection = match;
                  foundTask = taskItem;
                  foundProject = projectItem;
                  foundCompany = companyItem;
                  break;
                }
              }
              if (foundSection) break;
            }
            if (foundSection) break;
          }

          if (!active) return;
          setSection(foundSection);
          setTask(foundTask);
          setProject(foundProject);
          setCompany(foundCompany);
          if (foundSection?.content && typeof foundSection.content === "object" && !Array.isArray(foundSection.content)) {
            setSectionTextDraft(typeof foundSection.content.text === "string" ? foundSection.content.text : "");
          } else {
            setSectionTextDraft("");
          }
          return;
        }

        const companies = await getCompanies(token);
        const userLists = await Promise.all(companies.map((item) => getUsers(token, item.id).catch(() => [])));
        if (!active) return;
        const allUsers = userLists.flat();
        setUser(allUsers.find((item) => item.id === nodeId) ?? null);
      } catch (err) {
        if (!active) return;
        setError(err instanceof Error ? err.message : "Cannot load node data");
      } finally {
        if (active) setDataLoading(false);
      }
    };

    load();
    return () => {
      active = false;
    };
  }, [token, nodeType, nodeId]);

  const onSaveSection = async () => {
    if (!token || !section || !task) return;
    setSavingSection(true);
    setError(null);
    try {
      const updated = await updateTaskSection(token, task.id, section.id, {
        content: { text: sectionTextDraft }
      });
      setSection(updated);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Cannot save section");
    } finally {
      setSavingSection(false);
    }
  };

  return (
    <main>
      <h1>Node</h1>
      <p>
        <Link href="/">Back to graph</Link>
      </p>

      {(loading || dataLoading) && <div className="card">Loading node...</div>}
      {error && <div className="card error">{error}</div>}
      {!dataLoading && !error && !nodeType && <div className="card">Unsupported node type.</div>}

      {!dataLoading && !error && nodeType === "company" && company && (
        <section className="card">
          <h2>{company.name}</h2>
          <p>Context: company</p>
          <p>id: {company.id}</p>
        </section>
      )}

      {!dataLoading && !error && nodeType === "project" && project && (
        <>
          <section className="card">
            <h2>{project.name}</h2>
            <p>Context: project</p>
            <p>id: {project.id}</p>
            <p>company: {company?.name ?? `#${project.company_id}`}</p>
          </section>

          <section className="card">
            <h2>Child Context</h2>
            <div className="grid">
              <div>
                <h3>Tasks</h3>
                {projectTasks.length ? (
                  <ul className="projects-grid">
                    {projectTasks.map((item) => (
                      <li key={item.id}>
                        <Link href={`/nodes/task/${item.id}`} className="project-card-link">
                          <strong>{item.title}</strong>
                          <div>{item.description || "No description"}</div>
                          <small>id: {item.id}</small>
                        </Link>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p>No tasks.</p>
                )}
              </div>
              <div>
                <h3>Schedules</h3>
                {projectSchedules.length ? (
                  <ul className="projects-grid">
                    {projectSchedules.map((item) => (
                      <li key={item.id}>
                        <Link href={`/nodes/schedule/${item.id}`} className="project-card-link">
                          <strong>{item.title}</strong>
                          <div>{item.description || "No description"}</div>
                          <small>id: {item.id}</small>
                        </Link>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p>No schedules.</p>
                )}
              </div>
            </div>
          </section>
        </>
      )}

      {!dataLoading && !error && nodeType === "task" && task && (
        <>
          <section className="card">
            <h2>{task.title}</h2>
            <p>{task.description || "No description"}</p>
            <p>Context: task</p>
            <p>id: {task.id}</p>
            <p>project: {project?.name ?? `#${task.project_id}`}</p>
            <p>company: {company?.name ?? "-"}</p>
          </section>

          <section className="card">
            <h2>Document</h2>
            {taskSections.length ? (
              <ul className="list">
                {taskSections.map((item) => {
                  const text =
                    item.content && typeof item.content === "object" && !Array.isArray(item.content)
                      ? typeof item.content.text === "string"
                        ? item.content.text
                        : ""
                      : "";
                  return (
                    <li key={item.id}>
                      <div>
                        <strong>{item.title}</strong> <span className="badge">{item.key}</span>
                      </div>
                      <div style={{ whiteSpace: "pre-wrap", marginTop: 6 }}>{text || "No content"}</div>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p>No document sections.</p>
            )}
          </section>
        </>
      )}

      {!dataLoading && !error && nodeType === "schedule" && schedule && (
        <section className="card">
          <h2>{schedule.title}</h2>
          <p>{schedule.description || "No description"}</p>
          <p>Context: schedule</p>
          <p>id: {schedule.id}</p>
          <p>project: {project?.name ?? `#${schedule.project_id}`}</p>
          <p>company: {company?.name ?? "-"}</p>
        </section>
      )}

      {!dataLoading && !error && nodeType === "section" && section && (
        <section className="card">
          <h2>{section.title}</h2>
          <p>Context: section</p>
          <p>id: {section.id}</p>
          <p>key: {section.key}</p>
          <p>task: {task?.title ?? `#${section.task_id}`}</p>
          <p>project: {project?.name ?? "-"}</p>
          <p>company: {company?.name ?? "-"}</p>
          <label>
            Section content
            <textarea
              value={sectionTextDraft}
              onChange={(e) => setSectionTextDraft(e.target.value)}
              rows={10}
              style={{ width: "100%", border: "1px solid var(--border)", borderRadius: 8, padding: 10 }}
            />
          </label>
          <p style={{ marginTop: 8 }}>
            <button className="primary" type="button" onClick={onSaveSection} disabled={savingSection || !task}>
              {savingSection ? "Saving..." : "Save section"}
            </button>
          </p>
        </section>
      )}

      {!dataLoading && !error && nodeType === "user" && user && (
        <section className="card">
          <h2>{user.full_name}</h2>
          <p>{user.email}</p>
          <p>id: {user.id}</p>
        </section>
      )}

      {!dataLoading &&
        !error &&
        ((nodeType === "company" && !company) ||
          (nodeType === "project" && !project) ||
          (nodeType === "task" && !task) ||
          (nodeType === "schedule" && !schedule) ||
          (nodeType === "section" && !section) ||
          (nodeType === "user" && !user)) && <section className="card">Node not found.</section>}
    </main>
  );
}
