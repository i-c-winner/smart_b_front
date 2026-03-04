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
  TextField,
  Typography
} from "@mui/material";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import {
  assignTaskSectionPermission,
  clearTaskSectionPermission,
  clearTaskUserRoles,
  createTaskSection,
  deleteTask,
  deleteTaskSection,
  getProject,
  getTaskSectionPermissions,
  getTaskSections,
  getTasksByProject,
  getTaskUsers,
  getUsers
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
    <Container maxWidth="lg" sx={{ py: 3 }}>
      <Stack spacing={2}>
        <Box>
          <Typography variant="h4">Task Settings: {taskParam}</Typography>
          <MuiLink component={Link} href={`/settings/projects/${projectId}`} underline="hover">
            Back to project
          </MuiLink>
        </Box>

        <Button variant="outlined" onClick={() => setShowTaskValueForm((prev) => !prev)} sx={{ alignSelf: "flex-start" }}>
          Настройка задания
        </Button>

        {(loading || dataLoading) && (
          <Stack direction="row" spacing={1.5} alignItems="center">
            <CircularProgress size={20} />
            <Typography>Loading task settings...</Typography>
          </Stack>
        )}
        {error && <Alert severity="error">{error}</Alert>}
        {!dataLoading && !error && !task && <Alert severity="warning">Task not found in this project.</Alert>}

        {!dataLoading && !error && task && (
          <>
            <Paper variant="outlined" sx={{ p: 2 }}>
              <Typography variant="h6">Task</Typography>
              <Typography fontWeight={700}>{task.title}</Typography>
              <Typography color="text.secondary">{task.description || "No description"}</Typography>
              <Typography variant="body2" color="text.secondary">
                id: {task.id}
              </Typography>
            </Paper>

            {showTaskValueForm && (
              <Paper variant="outlined" sx={{ p: 2 }}>
                <Typography variant="h6" sx={{ mb: 1 }}>
                  Документ: разделы
                </Typography>
                <Stack direction={{ xs: "column", md: "row" }} spacing={1.5} sx={{ mb: 1.5 }}>
                  <TextField label="Section key" value={newSectionKey} onChange={(e) => setNewSectionKey(e.target.value)} fullWidth />
                  <TextField label="Section title" value={newSectionTitle} onChange={(e) => setNewSectionTitle(e.target.value)} fullWidth />
                </Stack>
                <Button
                  variant="outlined"
                  onClick={onCreateSection}
                  disabled={creatingSection || !newSectionKey.trim() || !newSectionTitle.trim()}
                >
                  {creatingSection ? "Creating..." : "Add section"}
                </Button>

                <Box sx={{ my: 2, borderTop: "1px solid", borderColor: "divider" }} />

                <FormControl fullWidth>
                  <InputLabel>Section</InputLabel>
                  <Select value={selectedSectionId} label="Section" onChange={(e) => setSelectedSectionId(String(e.target.value))}>
                    <MenuItem value="">Select section</MenuItem>
                    {sections.map((section) => (
                      <MenuItem key={section.id} value={String(section.id)}>
                        {section.title} ({section.key})
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>

                {selectedSectionId && (
                  <>
                    <Box sx={{ mt: 1.5 }}>
                      <Button variant="outlined" color="error" onClick={onDeleteSection} disabled={savingSection}>
                        Delete section
                      </Button>
                    </Box>

                    <Typography variant="subtitle1" sx={{ mt: 2, mb: 1 }}>
                      Section permissions
                    </Typography>
                    {sectionPermissions.length ? (
                      <Stack spacing={1}>
                        {sectionPermissions.map((perm) => (
                          <Paper
                            key={perm.id}
                            variant="outlined"
                            sx={{ p: 1.5, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 1 }}
                          >
                            <Typography>
                              <strong>{perm.full_name}</strong> ({perm.email}) - {perm.role}
                            </Typography>
                            <Button
                              variant="outlined"
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
                            </Button>
                          </Paper>
                        ))}
                      </Stack>
                    ) : (
                      <Typography color="text.secondary">No permissions yet.</Typography>
                    )}

                    <Stack direction={{ xs: "column", md: "row" }} spacing={1} sx={{ mt: 1.5 }}>
                      <FormControl fullWidth>
                        <InputLabel>Select user</InputLabel>
                        <Select value={selectedPermUserId} label="Select user" onChange={(e) => setSelectedPermUserId(String(e.target.value))}>
                          <MenuItem value="">Select user</MenuItem>
                          {displayCompanyUsers.map((user) => (
                            <MenuItem key={user.id} value={String(user.id)}>
                              {user.full_name}
                            </MenuItem>
                          ))}
                        </Select>
                      </FormControl>
                      <FormControl fullWidth>
                        <InputLabel>Role</InputLabel>
                        <Select
                          value={selectedPermRole}
                          label="Role"
                          onChange={(e) =>
                            setSelectedPermRole(e.target.value as "section_viewer" | "section_editor" | "section_manager")
                          }
                        >
                          {SECTION_ROLE_OPTIONS.map((option) => (
                            <MenuItem key={option.value} value={option.value}>
                              {option.label}
                            </MenuItem>
                          ))}
                        </Select>
                      </FormControl>
                      <Button variant="contained" disabled={!selectedPermUserId || savingSection} onClick={onAssignSectionPermission}>
                        Assign
                      </Button>
                    </Stack>
                  </>
                )}
              </Paper>
            )}

            <Paper variant="outlined" sx={{ p: 2 }}>
              <Typography variant="h6" sx={{ mb: 1 }}>
                Assigned Roles
              </Typography>
              {displayTaskRoles.length ? (
                <Stack spacing={1}>
                  {displayTaskRoles.map((role) => (
                    <Paper
                      key={`${role.id}-${role.role}`}
                      variant="outlined"
                      sx={{ p: 1.5, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 1.5 }}
                    >
                      <Box>
                        <Typography>
                          <strong>{role.full_name}</strong> ({role.email}) - {taskRoleLabel(role.role)}
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
                      </Button>
                    </Paper>
                  ))}
                </Stack>
              ) : (
                <Typography color="text.secondary">No role assignments in task context.</Typography>
              )}
            </Paper>

            <Paper variant="outlined" sx={{ p: 2 }}>
              <Typography variant="h6" sx={{ mb: 1 }}>
                Danger Zone
              </Typography>
              <Button variant="outlined" color="error" onClick={onDelete} disabled={deleting}>
                {deleting ? "Deleting..." : "Delete task"}
              </Button>
            </Paper>
          </>
        )}
      </Stack>
    </Container>
  );
}
