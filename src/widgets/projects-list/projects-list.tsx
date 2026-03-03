"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import type { Project, User, UserBrief } from "@/shared/types/domain";

type Props = {
  projects: Project[];
  companyUsers: User[];
  adminsByProject: Record<number, UserBrief[]>;
  onAssignAdmin: (projectId: number, userId: number) => Promise<void>;
};

export function ProjectsList({ projects, companyUsers, adminsByProject, onAssignAdmin }: Props) {
  const router = useRouter();
  const [selectedByProject, setSelectedByProject] = useState<Record<number, string>>({});
  const [assigningProjectId, setAssigningProjectId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  return (
    <section className="card">
      <h2>Projects</h2>
      {error && <p className="error">{error}</p>}
      <ul className="projects-grid">
        {projects.map((project) => (
          <li key={project.id}>
            <div
              className="project-card-link"
              onClick={() => router.push(`/settings/projects/${project.id}`)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  router.push(`/settings/projects/${project.id}`);
                }
              }}
              role="button"
              tabIndex={0}
            >
              <strong>{project.name}</strong>
              <div>company_id: {project.company_id}</div>
              <small>id: {project.id}</small>
              <div className="project-admins-list">
                <strong>Current admins:</strong>{" "}
                {adminsByProject[project.id]?.length
                  ? adminsByProject[project.id].map((admin) => admin.full_name).join(", ")
                  : "none"}
              </div>
              <div className="project-admin-row" onClick={(e) => e.stopPropagation()}>
                <select
                  value={selectedByProject[project.id] ?? ""}
                  onChange={(e) =>
                    setSelectedByProject((prev) => ({
                      ...prev,
                      [project.id]: e.target.value
                    }))
                  }
                >
                  <option value="">Select company user</option>
                  {companyUsers.map((user) => (
                    <option key={user.id} value={String(user.id)}>
                      {user.full_name} ({user.email})
                    </option>
                  ))}
                </select>
                <button
                  className="secondary"
                  type="button"
                  disabled={!selectedByProject[project.id] || assigningProjectId === project.id}
                  onClick={async (e) => {
                    e.stopPropagation();
                    setError(null);
                    const userId = Number(selectedByProject[project.id]);
                    if (!userId) return;
                    try {
                      setAssigningProjectId(project.id);
                      await onAssignAdmin(project.id, userId);
                    } catch (err) {
                      setError(err instanceof Error ? err.message : "Cannot assign project admin");
                    } finally {
                      setAssigningProjectId(null);
                    }
                  }}
                >
                  {assigningProjectId === project.id ? "Assigning..." : "Assign admin"}
                </button>
              </div>
            </div>
          </li>
        ))}
      </ul>
      {!projects.length && <p>No projects found.</p>}
    </section>
  );
}
