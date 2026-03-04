"use client";

import {
  Alert,
  Box,
  Button,
  Card,
  CardActionArea,
  CardContent,
  CircularProgress,
  Container,
  FormControl,
  Grid,
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
    <Container maxWidth="lg" sx={{ py: 3 }}>
      <Stack spacing={2}>
        <Box>
          <Typography variant="h4">Project Settings: {projectParam}</Typography>
          <MuiLink component={Link} href="/settings" underline="hover">
            Back to settings
          </MuiLink>
        </Box>

        {(loading || dataLoading) && (
          <Stack direction="row" spacing={1.5} alignItems="center">
            <CircularProgress size={20} />
            <Typography>Loading project data...</Typography>
          </Stack>
        )}
        {error && <Alert severity="error">{error}</Alert>}

        {!dataLoading && !error && (
          <>
            <Paper variant="outlined" sx={{ p: 2 }}>
              <Typography variant="h6" sx={{ mb: 1 }}>
                Project Managers
              </Typography>
              {projectManagers.length ? (
                <Stack spacing={1}>
                  {projectManagers.map((manager) => (
                    <Paper
                      key={manager.id}
                      variant="outlined"
                      sx={{ p: 1.5, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 1.5 }}
                    >
                      <Typography>
                        <strong>{manager.full_name}</strong> ({manager.email})
                      </Typography>
                      <Button
                        variant="outlined"
                        onClick={() => onRemoveManager(manager.id)}
                        disabled={removingManagerId === manager.id}
                      >
                        {removingManagerId === manager.id ? "Removing..." : "Remove role"}
                      </Button>
                    </Paper>
                  ))}
                </Stack>
              ) : (
                <Typography color="text.secondary">No project managers.</Typography>
              )}
            </Paper>

            <Paper variant="outlined" sx={{ p: 2 }}>
              <Typography variant="h6" sx={{ mb: 1 }}>
                Task
              </Typography>
              {tasks.length > 0 ? (
                <Grid container spacing={1.5} sx={{ mb: 2 }}>
                  {tasks.map((task) => (
                    <Grid size={{ xs: 12, md: 6 }} key={task.id}>
                      <Card variant="outlined">
                        <CardActionArea component={Link} href={`/settings/projects/${projectId}/tasks/${task.id}`}>
                          <CardContent>
                            <Typography variant="subtitle1" fontWeight={700}>
                              {task.title}
                            </Typography>
                            <Typography color="text.secondary">{task.description || "No description"}</Typography>
                            <Typography variant="body2" color="text.secondary">
                              id: {task.id}
                            </Typography>
                          </CardContent>
                        </CardActionArea>
                        <Box sx={{ p: 1.5, pt: 0 }}>
                          <Stack direction="row" spacing={1}>
                            <FormControl fullWidth size="small">
                              <InputLabel>Select company user</InputLabel>
                              <Select
                                label="Select company user"
                                value={selectedTaskManagerByTask[task.id] ?? ""}
                                onChange={(e) =>
                                  setSelectedTaskManagerByTask((prev) => ({
                                    ...prev,
                                    [task.id]: String(e.target.value)
                                  }))
                                }
                              >
                                <MenuItem value="">Select company user</MenuItem>
                                {displayCompanyUsers.map((user) => (
                                  <MenuItem key={user.id} value={String(user.id)}>
                                    {user.full_name}
                                  </MenuItem>
                                ))}
                              </Select>
                            </FormControl>
                            <Button
                              variant="outlined"
                              disabled={!selectedTaskManagerByTask[task.id] || assigningContextKey === `task-${task.id}`}
                              onClick={() => onAssignTaskManager(task.id)}
                            >
                              {assigningContextKey === `task-${task.id}` ? "Assigning..." : "Assign task manager"}
                            </Button>
                          </Stack>
                        </Box>
                      </Card>
                    </Grid>
                  ))}
                </Grid>
              ) : (
                <Typography color="text.secondary" sx={{ mb: 2 }}>
                  No tasks yet.
                </Typography>
              )}
              <Stack component="form" spacing={1.5} onSubmit={onCreateTask}>
                <TextField label="Title" value={taskTitle} onChange={(e) => setTaskTitle(e.target.value)} required />
                <TextField label="Description" value={taskDescription} onChange={(e) => setTaskDescription(e.target.value)} />
                <Button variant="contained" type="submit" disabled={submittingTask}>
                  {submittingTask ? "Creating..." : "Add task"}
                </Button>
              </Stack>
            </Paper>

            <Paper variant="outlined" sx={{ p: 2 }}>
              <Typography variant="h6" sx={{ mb: 1 }}>
                Schedule
              </Typography>
              {schedules.length > 0 ? (
                <Grid container spacing={1.5} sx={{ mb: 2 }}>
                  {schedules.map((schedule) => (
                    <Grid size={{ xs: 12, md: 6 }} key={schedule.id}>
                      <Card variant="outlined">
                        <CardActionArea component={Link} href={`/settings/projects/${projectId}/schedules/${schedule.id}`}>
                          <CardContent>
                            <Typography variant="subtitle1" fontWeight={700}>
                              {schedule.title}
                            </Typography>
                            <Typography color="text.secondary">{schedule.description || "No description"}</Typography>
                            <Typography variant="body2" color="text.secondary">
                              id: {schedule.id}
                            </Typography>
                          </CardContent>
                        </CardActionArea>
                        <Box sx={{ p: 1.5, pt: 0 }}>
                          <Stack direction="row" spacing={1}>
                            <FormControl fullWidth size="small">
                              <InputLabel>Select company user</InputLabel>
                              <Select
                                label="Select company user"
                                value={selectedScheduleManagerBySchedule[schedule.id] ?? ""}
                                onChange={(e) =>
                                  setSelectedScheduleManagerBySchedule((prev) => ({
                                    ...prev,
                                    [schedule.id]: String(e.target.value)
                                  }))
                                }
                              >
                                <MenuItem value="">Select company user</MenuItem>
                                {displayCompanyUsers.map((user) => (
                                  <MenuItem key={user.id} value={String(user.id)}>
                                    {user.full_name}
                                  </MenuItem>
                                ))}
                              </Select>
                            </FormControl>
                            <Button
                              variant="outlined"
                              disabled={
                                !selectedScheduleManagerBySchedule[schedule.id] ||
                                assigningContextKey === `schedule-${schedule.id}`
                              }
                              onClick={() => onAssignScheduleManager(schedule.id)}
                            >
                              {assigningContextKey === `schedule-${schedule.id}` ? "Assigning..." : "Assign schedule manager"}
                            </Button>
                          </Stack>
                        </Box>
                      </Card>
                    </Grid>
                  ))}
                </Grid>
              ) : (
                <Typography color="text.secondary" sx={{ mb: 2 }}>
                  No schedules yet.
                </Typography>
              )}
              <Stack component="form" spacing={1.5} onSubmit={onCreateSchedule}>
                <TextField label="Title" value={scheduleTitle} onChange={(e) => setScheduleTitle(e.target.value)} required />
                <TextField
                  label="Description"
                  value={scheduleDescription}
                  onChange={(e) => setScheduleDescription(e.target.value)}
                />
                <Button variant="contained" type="submit" disabled={submittingSchedule}>
                  {submittingSchedule ? "Creating..." : "Add schedule"}
                </Button>
              </Stack>
            </Paper>
          </>
        )}
      </Stack>
    </Container>
  );
}
