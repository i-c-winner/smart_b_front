"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

import { LogoutButton } from "@/features/auth/logout/logout-button";
import {
  getCompanies,
  getCompanyUsersWithRoles,
  getProjectUsers,
  getSchedule,
  getScheduleUsers,
  getTask,
  getTaskUsers
} from "@/shared/api/domain-api";
import { useAuth } from "@/shared/lib/auth/auth-context";

export function AppHeader() {
  const pathname = usePathname();
  const { currentUser, token, loading } = useAuth();
  const [showSettings, setShowSettings] = useState(false);
  const [settingsHref, setSettingsHref] = useState("/settings");

  useEffect(() => {
    if (!token || !currentUser) {
      setShowSettings(false);
      return;
    }

    const segments = (pathname ?? "/").split("/").filter(Boolean);
    let active = true;

    const check = async () => {
      setShowSettings(false);

      // /settings/projects/{project}/tasks/{task}
      if (
        segments[0] === "settings" &&
        segments[1] === "projects" &&
        segments[2] &&
        segments[3] === "tasks" &&
        segments[4]
      ) {
        const projectId = Number(segments[2]);
        const taskId = Number(segments[4]);
        if (Number.isNaN(projectId) || Number.isNaN(taskId)) return;
        setSettingsHref(`/settings/projects/${projectId}/tasks/${taskId}`);
        const users = await getTaskUsers(token, taskId).catch(() => []);
        if (!active) return;
        const isManager = users.some((user) => user.id === currentUser.id && user.role === "task_manager");
        setShowSettings(isManager);
        return;
      }

      // /settings/projects/{project}/schedules/{schedule}
      if (
        segments[0] === "settings" &&
        segments[1] === "projects" &&
        segments[2] &&
        segments[3] === "schedules" &&
        segments[4]
      ) {
        const projectId = Number(segments[2]);
        const scheduleId = Number(segments[4]);
        if (Number.isNaN(projectId) || Number.isNaN(scheduleId)) return;
        setSettingsHref(`/settings/projects/${projectId}/schedules/${scheduleId}`);
        const users = await getScheduleUsers(token, scheduleId).catch(() => []);
        if (!active) return;
        const isManager = users.some((user) => user.id === currentUser.id && user.role === "schedule_manager");
        setShowSettings(isManager);
        return;
      }

      // /settings/projects/{project}
      if (segments[0] === "settings" && segments[1] === "projects" && segments[2]) {
        const projectId = Number(segments[2]);
        if (Number.isNaN(projectId)) return;
        setSettingsHref(`/settings/projects/${projectId}`);
        const users = await getProjectUsers(token, projectId).catch(() => []);
        if (!active) return;
        const isManager = users.some((user) => user.id === currentUser.id && user.role === "project_manager");
        setShowSettings(isManager);
        return;
      }

      // /nodes/project/{project}
      if (segments[0] === "nodes" && segments[1] === "project" && segments[2]) {
        const projectId = Number(segments[2]);
        if (Number.isNaN(projectId)) return;
        setSettingsHref(`/settings/projects/${projectId}`);
        const users = await getProjectUsers(token, projectId).catch(() => []);
        if (!active) return;
        const isManager = users.some((user) => user.id === currentUser.id && user.role === "project_manager");
        setShowSettings(isManager);
        return;
      }

      // /nodes/task/{task}
      if (segments[0] === "nodes" && segments[1] === "task" && segments[2]) {
        const taskId = Number(segments[2]);
        if (Number.isNaN(taskId)) return;
        const task = await getTask(token, taskId).catch(() => null);
        if (!active || !task) return;
        setSettingsHref(`/settings/projects/${task.project_id}/tasks/${taskId}`);
        const users = await getTaskUsers(token, taskId).catch(() => []);
        if (!active) return;
        const isManager = users.some((user) => user.id === currentUser.id && user.role === "task_manager");
        setShowSettings(isManager);
        return;
      }

      // /nodes/schedule/{schedule}
      if (segments[0] === "nodes" && segments[1] === "schedule" && segments[2]) {
        const scheduleId = Number(segments[2]);
        if (Number.isNaN(scheduleId)) return;
        const schedule = await getSchedule(token, scheduleId).catch(() => null);
        if (!active || !schedule) return;
        setSettingsHref(`/settings/projects/${schedule.project_id}/schedules/${scheduleId}`);
        const users = await getScheduleUsers(token, scheduleId).catch(() => []);
        if (!active) return;
        const isManager = users.some((user) => user.id === currentUser.id && user.role === "schedule_manager");
        setShowSettings(isManager);
        return;
      }

      // Fallback for all other pages: check company manager role in current company context.
      setSettingsHref("/settings");
      const companies = await getCompanies(token).catch(() => []);
      if (!active || !companies.length) return;
      const companyUsers = await getCompanyUsersWithRoles(token, companies[0].id).catch(() => []);
      if (!active) return;
      const isCompanyManager = companyUsers.some(
        (user) =>
          user.id === currentUser.id && (user.role === "company_manager" || user.role === "company_admin")
      );
      setShowSettings(isCompanyManager);
    };

    check();

    return () => {
      active = false;
    };
  }, [token, currentUser, pathname]);

  return (
    <header className="app-header">
      <div className="app-header-inner">
        <Link href="/" className="app-header-brand">
          SmartB
        </Link>
        <div className="app-header-right">
          <Link href="/" className="secondary app-header-login">
            Home
          </Link>
          {showSettings && (
            <Link href={settingsHref} className="secondary app-header-login">
              Settings
            </Link>
          )}
          <span className="app-header-user">
            {loading ? "Loading..." : currentUser ? currentUser.full_name : "Guest"}
          </span>
          {token ? (
            <LogoutButton />
          ) : (
            <Link href="/login" className="secondary app-header-login">
              Login
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
