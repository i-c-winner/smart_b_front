"use client";

import { Alert, Box, Button, CircularProgress, Container, Paper, Stack, Typography } from "@mui/material";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { CreateProjectForm } from "@/features/project/create-project/create-project-form";
import { CreateCompanyUserForm } from "@/features/user/create-company-user/create-company-user-form";
import {
  assignProjectAdmin,
  createCompanyUser,
  createProject,
  getCompanies,
  getProjectAdmins,
  getProjects,
  getUsers
} from "@/shared/api/domain-api";
import { useAuth } from "@/shared/lib/auth/auth-context";
import { prepareUsersForDisplay } from "@/shared/lib/users/prepare-users-for-display";
import type { Company, Project, User, UserBrief } from "@/shared/types/domain";
import { ProjectsList } from "@/widgets/projects-list/projects-list";

export function SettingsPage() {
  const router = useRouter();
  const { token, loading } = useAuth();
  const [currentCompany, setCurrentCompany] = useState<Company | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [companyUsers, setCompanyUsers] = useState<User[]>([]);
  const [adminsByProject, setAdminsByProject] = useState<Record<number, UserBrief[]>>({});
  const [error, setError] = useState<string | null>(null);
  const [dataLoading, setDataLoading] = useState(false);
  const [showAddUser, setShowAddUser] = useState(false);

  useEffect(() => {
    if (!loading && !token) {
      router.replace("/login");
      return;
    }
  }, [loading, token, router]);

  useEffect(() => {
    if (!token) {
      setCurrentCompany(null);
      setProjects([]);
      setCompanyUsers([]);
      setAdminsByProject({});
      setError(null);
      return;
    }

    let active = true;

    const fetchData = async () => {
      setDataLoading(true);
      setError(null);
      try {
        const companiesData = await getCompanies(token);
        if (!active) return;
        const firstCompany = companiesData[0] ?? null;
        setCurrentCompany(firstCompany);
        if (!firstCompany) {
          setProjects([]);
          setCompanyUsers([]);
          setAdminsByProject({});
          return;
        }
        const [projectsData, usersData, projectAdminsData] = await Promise.all([
          getProjects(token, firstCompany.id),
          getUsers(token, firstCompany.id),
          getProjectAdmins(token, firstCompany.id)
        ]);
        if (!active) return;
        setProjects(projectsData);
        setCompanyUsers(prepareUsersForDisplay(usersData));
        setAdminsByProject(
          projectAdminsData.reduce<Record<number, UserBrief[]>>((acc, item) => {
            acc[item.project_id] = prepareUsersForDisplay(item.admins);
            return acc;
          }, {})
        );
      } catch (err) {
        if (!active) return;
        setError(
          err instanceof Error
            ? `Cannot load projects. Check backend endpoints /companies and /projects. ${err.message}`
            : "Cannot load projects"
        );
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
  }, [token]);

  const onCreateProject = async (name: string) => {
    if (!token || !currentCompany) {
      throw new Error("Current company not found");
    }
    await createProject(token, { company_id: currentCompany.id, name });
    const [updatedProjects, updatedAdmins] = await Promise.all([
      getProjects(token, currentCompany.id),
      getProjectAdmins(token, currentCompany.id)
    ]);
    setProjects(updatedProjects);
    setAdminsByProject(
      updatedAdmins.reduce<Record<number, UserBrief[]>>((acc, item) => {
        acc[item.project_id] = prepareUsersForDisplay(item.admins);
        return acc;
      }, {})
    );
  };

  const onCreateUser = async (payload: { email: string; full_name: string; password: string }) => {
    if (!token || !currentCompany) {
      throw new Error("Current company not found");
    }
    await createCompanyUser(token, { ...payload, company_id: currentCompany.id });
    const usersData = await getUsers(token, currentCompany.id);
    setCompanyUsers(prepareUsersForDisplay(usersData));
    setShowAddUser(false);
  };

  const onAssignAdmin = async (projectId: number, userId: number) => {
    if (!token || !currentCompany) {
      throw new Error("Not authenticated");
    }
    await assignProjectAdmin(token, projectId, userId);
    const updatedAdmins = await getProjectAdmins(token, currentCompany.id);
    setAdminsByProject(
      updatedAdmins.reduce<Record<number, UserBrief[]>>((acc, item) => {
        acc[item.project_id] = prepareUsersForDisplay(item.admins);
        return acc;
      }, {})
    );
  };

  return (
    <Container maxWidth="lg" sx={{ py: 3 }}>
      <Stack spacing={2}>
        <Box>
          <Typography variant="h4">Settings</Typography>
          <Typography color="text.secondary">Project settings workspace.</Typography>
        </Box>
        {(loading || !token) && (
          <Stack direction="row" spacing={1.5} alignItems="center">
            <CircularProgress size={20} />
            <Typography>Loading session...</Typography>
          </Stack>
        )}

        {token && (
          <>
            <Paper variant="outlined" sx={{ p: 1.5, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <Typography fontWeight={700}>Actions</Typography>
              <Button variant="contained" onClick={() => setShowAddUser((prev) => !prev)} disabled={!currentCompany}>
                {showAddUser ? "Close add user" : "Add user"}
              </Button>
            </Paper>
            {dataLoading && (
              <Stack direction="row" spacing={1.5} alignItems="center">
                <CircularProgress size={20} />
                <Typography>Loading projects...</Typography>
              </Stack>
            )}
            {error && <Alert severity="error">{error}</Alert>}
            {!dataLoading && !error && !currentCompany && (
              <Alert severity="warning">No accessible companies. Ask admin to assign role in company context.</Alert>
            )}
            {!dataLoading && !error && currentCompany && (
              <>
                {showAddUser && <CreateCompanyUserForm companyName={currentCompany.name} onCreate={onCreateUser} />}
                <CreateProjectForm companyName={currentCompany.name} onCreate={onCreateProject} />
                <ProjectsList
                  projects={projects}
                  companyUsers={companyUsers}
                  adminsByProject={adminsByProject}
                  onAssignAdmin={onAssignAdmin}
                />
              </>
            )}
          </>
        )}
      </Stack>
    </Container>
  );
}
