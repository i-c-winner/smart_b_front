"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import {
  assignScheduleUserRole,
  deleteSchedule,
  getProject,
  getScheduleByProject,
  getScheduleUsers,
  getUsers
} from "@/shared/api/domain-api";
import { useAuth } from "@/shared/lib/auth/auth-context";
import { prepareUsersForDisplay } from "@/shared/lib/users/prepare-users-for-display";
import type { Schedule, ScopedUserRole, User } from "@/shared/types/domain";

const ROLE_OPTIONS = [
  { value: "schedule_viewer", label: "Schedule Viewer" },
  { value: "schedule_member", label: "Schedule Member" },
  { value: "schedule_manager", label: "Schedule Manager" }
] as const;

function scheduleRoleLabel(role: string): string {
  return role;
}

export function ScheduleSettingsPage() {
  const router = useRouter();
  const params = useParams<{ project: string; schedule: string }>();
  const { token, loading } = useAuth();
  const [schedule, setSchedule] = useState<Schedule | null>(null);
  const [companyUsers, setCompanyUsers] = useState<User[]>([]);
  const [scheduleRoles, setScheduleRoles] = useState<ScopedUserRole[]>([]);
  const [selectedUserId, setSelectedUserId] = useState("");
  const [selectedRole, setSelectedRole] = useState<"schedule_viewer" | "schedule_member" | "schedule_manager">(
    "schedule_viewer"
  );
  const [error, setError] = useState<string | null>(null);
  const [dataLoading, setDataLoading] = useState(false);
  const [assigning, setAssigning] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const projectParam = params?.project ?? "";
  const scheduleParam = params?.schedule ?? "";
  const projectId = useMemo(() => Number(projectParam), [projectParam]);
  const scheduleId = useMemo(() => Number(scheduleParam), [scheduleParam]);
  const displayCompanyUsers = useMemo(() => prepareUsersForDisplay(companyUsers), [companyUsers]);
  const displayScheduleRoles = useMemo(() => prepareUsersForDisplay(scheduleRoles), [scheduleRoles]);

  useEffect(() => {
    if (!loading && !token) {
      router.replace("/login");
    }
  }, [loading, token, router]);

  useEffect(() => {
    if (!token || Number.isNaN(projectId) || Number.isNaN(scheduleId)) return;

    let active = true;
    const fetchData = async () => {
      setDataLoading(true);
      setError(null);
      try {
        const [projectData, schedulesData, rolesData] = await Promise.all([
          getProject(token, projectId),
          getScheduleByProject(token, projectId),
          getScheduleUsers(token, scheduleId)
        ]);
        const companyUsersData = await getUsers(token, projectData.company_id);
        if (!active) return;
        const found = (Array.isArray(schedulesData) ? schedulesData : []).find((item) => item.id === scheduleId) ?? null;
        setSchedule(found);
        setCompanyUsers(companyUsersData);
        setScheduleRoles(Array.isArray(rolesData) ? rolesData : []);
      } catch (err) {
        if (!active) return;
        setError(err instanceof Error ? err.message : "Cannot load schedule settings");
      } finally {
        if (active) setDataLoading(false);
      }
    };

    fetchData();
    return () => {
      active = false;
    };
  }, [token, projectId, scheduleId]);

  const onAssignRole = async () => {
    if (!token) return;
    const userId = Number(selectedUserId);
    if (!userId) return;
    setAssigning(true);
    setError(null);
    try {
      await assignScheduleUserRole(token, scheduleId, { user_id: userId, role: selectedRole });
      const roles = await getScheduleUsers(token, scheduleId);
      setScheduleRoles(Array.isArray(roles) ? roles : []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Cannot assign schedule role");
    } finally {
      setAssigning(false);
    }
  };

  const onDelete = async () => {
    if (!token) return;
    setDeleting(true);
    setError(null);
    try {
      await deleteSchedule(token, scheduleId);
      router.push(`/settings/projects/${projectId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Cannot delete schedule");
      setDeleting(false);
    }
  };

  return (
    <main>
      <h1>Schedule Settings: {scheduleParam}</h1>
      <p>
        <Link href={`/settings/projects/${projectId}`}>Back to project</Link>
      </p>

      {(loading || dataLoading) && <div className="card">Loading schedule settings...</div>}
      {error && <div className="card error">{error}</div>}

      {!dataLoading && !error && !schedule && <div className="card">Schedule not found in this project.</div>}

      {!dataLoading && !error && schedule && (
        <>
          <section className="card">
            <h2>Schedule</h2>
            <div>
              <strong>{schedule.title}</strong>
            </div>
            <div>{schedule.description || "No description"}</div>
            <small>id: {schedule.id}</small>
          </section>

          <section className="card">
            <h2>Assigned Roles</h2>
            {displayScheduleRoles.length ? (
              <ul className="list">
                {displayScheduleRoles.map((role) => (
                  <li key={`${role.id}-${role.role}`}>
                    <strong>{role.full_name}</strong> ({role.email}) -{" "}
                    <span className="badge">{scheduleRoleLabel(role.role)}</span>
                    <div>
                      context: <span className="badge">{role.scope_type}</span> #{role.scope_id}
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <p>No role assignments in schedule context.</p>
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
                onChange={(e) =>
                  setSelectedRole(e.target.value as "schedule_viewer" | "schedule_member" | "schedule_manager")
                }
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
              {deleting ? "Deleting..." : "Delete schedule"}
            </button>
          </section>
        </>
      )}
    </main>
  );
}
