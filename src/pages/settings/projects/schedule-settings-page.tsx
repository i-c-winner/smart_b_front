"use client";

import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Container,
  FormControl,
  InputLabel,
  Link as MuiLink,
  MenuItem,
  Paper,
  Select,
  Stack,
  Typography
} from "@mui/material";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import {
  assignScheduleUserRole,
  clearScheduleUserRoles,
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
  { value: "", label: "No role" },
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
  const [selectedRole, setSelectedRole] = useState<"" | "schedule_viewer" | "schedule_member" | "schedule_manager">("");
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
      if (!selectedRole) {
        await clearScheduleUserRoles(token, scheduleId, userId);
      } else {
        await assignScheduleUserRole(token, scheduleId, { user_id: userId, role: selectedRole });
      }
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
    <Container maxWidth="lg" sx={{ py: 3 }}>
      <Stack spacing={2}>
        <Box>
          <Typography variant="h4">Schedule Settings: {scheduleParam}</Typography>
          <MuiLink component={Link} href={`/settings/projects/${projectId}`} underline="hover">
            Back to project
          </MuiLink>
        </Box>

        {(loading || dataLoading) && (
          <Stack direction="row" spacing={1.5} alignItems="center">
            <CircularProgress size={20} />
            <Typography>Loading schedule settings...</Typography>
          </Stack>
        )}
        {error && <Alert severity="error">{error}</Alert>}

        {!dataLoading && !error && !schedule && <Alert severity="warning">Schedule not found in this project.</Alert>}

        {!dataLoading && !error && schedule && (
          <>
            <Paper variant="outlined" sx={{ p: 2 }}>
              <Typography variant="h6">Schedule</Typography>
              <Typography fontWeight={700}>{schedule.title}</Typography>
              <Typography color="text.secondary">{schedule.description || "No description"}</Typography>
              <Typography variant="body2" color="text.secondary">
                id: {schedule.id}
              </Typography>
            </Paper>

            <Paper variant="outlined" sx={{ p: 2 }}>
              <Typography variant="h6" sx={{ mb: 1 }}>
                Assigned Roles
              </Typography>
              {displayScheduleRoles.length ? (
                <Stack spacing={1}>
                  {displayScheduleRoles.map((role) => (
                    <Paper
                      key={`${role.id}-${role.role}`}
                      variant="outlined"
                      sx={{ p: 1.5, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 1.5 }}
                    >
                      <Box>
                        <Typography>
                          <strong>{role.full_name}</strong> ({role.email}) - {scheduleRoleLabel(role.role)}
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          context: {role.scope_type} #{role.scope_id}
                        </Typography>
                      </Box>
                      <Button
                        variant="outlined"
                        disabled={assigning}
                        onClick={async () => {
                          if (!token) return;
                          setAssigning(true);
                          setError(null);
                          try {
                            await clearScheduleUserRoles(token, scheduleId, role.id);
                            const roles = await getScheduleUsers(token, scheduleId);
                            setScheduleRoles(Array.isArray(roles) ? roles : []);
                          } catch (err) {
                            setError(err instanceof Error ? err.message : "Cannot remove schedule role");
                          } finally {
                            setAssigning(false);
                          }
                        }}
                      >
                        Remove role
                      </Button>
                    </Paper>
                  ))}
                </Stack>
              ) : (
                <Typography color="text.secondary">No role assignments in schedule context.</Typography>
              )}
            </Paper>

            <Paper variant="outlined" sx={{ p: 2 }}>
              <Typography variant="h6" sx={{ mb: 1 }}>
                Assign User Role
              </Typography>
              <Stack direction={{ xs: "column", md: "row" }} spacing={1}>
                <FormControl fullWidth>
                  <InputLabel>Select company user</InputLabel>
                  <Select value={selectedUserId} label="Select company user" onChange={(e) => setSelectedUserId(String(e.target.value))}>
                    <MenuItem value="">Select company user</MenuItem>
                    {displayCompanyUsers.map((user) => (
                      <MenuItem key={user.id} value={String(user.id)}>
                        {user.full_name} ({user.email})
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
                <FormControl fullWidth>
                  <InputLabel>Role</InputLabel>
                  <Select
                    value={selectedRole}
                    label="Role"
                    onChange={(e) =>
                      setSelectedRole(e.target.value as "" | "schedule_viewer" | "schedule_member" | "schedule_manager")
                    }
                  >
                    {ROLE_OPTIONS.map((option) => (
                      <MenuItem key={option.value} value={option.value}>
                        {option.label}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
                <Button variant="contained" disabled={!selectedUserId || assigning} onClick={onAssignRole}>
                  {assigning ? "Applying..." : "Apply role"}
                </Button>
              </Stack>
            </Paper>

            <Paper variant="outlined" sx={{ p: 2 }}>
              <Typography variant="h6" sx={{ mb: 1 }}>
                Danger Zone
              </Typography>
              <Button variant="outlined" color="error" onClick={onDelete} disabled={deleting}>
                {deleting ? "Deleting..." : "Delete schedule"}
              </Button>
            </Paper>
          </>
        )}
      </Stack>
    </Container>
  );
}
