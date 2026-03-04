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
  Grid,
  Link as MuiLink,
  Paper,
  Stack,
  TextField,
  Typography
} from "@mui/material";
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
  const [savedSectionText, setSavedSectionText] = useState("");
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
      setSavedSectionText("");
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
            const text = typeof foundSection.content.text === "string" ? foundSection.content.text : "";
            setSectionTextDraft(text);
            setSavedSectionText(text);
          } else {
            setSectionTextDraft("");
            setSavedSectionText("");
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
      const text =
        updated.content && typeof updated.content === "object" && !Array.isArray(updated.content)
          ? typeof updated.content.text === "string"
            ? updated.content.text
            : ""
          : "";
      setSectionTextDraft(text);
      setSavedSectionText(text);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Cannot save section");
    } finally {
      setSavingSection(false);
    }
  };

  const canSaveSection = Boolean(task) && sectionTextDraft !== savedSectionText && !savingSection;

  return (
    <Container maxWidth="lg" sx={{ py: 3 }}>
      <Stack spacing={2}>
        <Box>
          <Typography variant="h4">Node</Typography>
          <MuiLink component={Link} href="/" underline="hover">
            Back to graph
          </MuiLink>
        </Box>

        {(loading || dataLoading) && (
          <Stack direction="row" spacing={1.5} alignItems="center">
            <CircularProgress size={20} />
            <Typography>Loading node...</Typography>
          </Stack>
        )}
        {error && <Alert severity="error">{error}</Alert>}
        {!dataLoading && !error && !nodeType && <Alert severity="warning">Unsupported node type.</Alert>}

        {!dataLoading && !error && nodeType === "company" && company && (
          <Paper variant="outlined" sx={{ p: 2 }}>
            <Typography variant="h6">{company.name}</Typography>
            <Typography color="text.secondary">Context: company</Typography>
            <Typography color="text.secondary">id: {company.id}</Typography>
          </Paper>
        )}

        {!dataLoading && !error && nodeType === "project" && project && (
          <>
            <Paper variant="outlined" sx={{ p: 2 }}>
              <Typography variant="h6">{project.name}</Typography>
              <Typography color="text.secondary">Context: project</Typography>
              <Typography color="text.secondary">id: {project.id}</Typography>
              <Typography color="text.secondary">company: {company?.name ?? `#${project.company_id}`}</Typography>
            </Paper>

            <Paper variant="outlined" sx={{ p: 2 }}>
              <Typography variant="h6" sx={{ mb: 1 }}>
                Child Context
              </Typography>
              <Grid container spacing={2}>
                <Grid size={{ xs: 12, md: 6 }}>
                  <Typography variant="subtitle1" sx={{ mb: 1 }}>
                    Tasks
                  </Typography>
                  {projectTasks.length ? (
                    <Stack spacing={1}>
                      {projectTasks.map((item) => (
                        <Card key={item.id} variant="outlined">
                          <CardActionArea component={Link} href={`/nodes/task/${item.id}`}>
                            <CardContent>
                              <Typography fontWeight={700}>{item.title}</Typography>
                              <Typography color="text.secondary">{item.description || "No description"}</Typography>
                              <Typography variant="body2" color="text.secondary">
                                id: {item.id}
                              </Typography>
                            </CardContent>
                          </CardActionArea>
                        </Card>
                      ))}
                    </Stack>
                  ) : (
                    <Typography color="text.secondary">No tasks.</Typography>
                  )}
                </Grid>
                <Grid size={{ xs: 12, md: 6 }}>
                  <Typography variant="subtitle1" sx={{ mb: 1 }}>
                    Schedules
                  </Typography>
                  {projectSchedules.length ? (
                    <Stack spacing={1}>
                      {projectSchedules.map((item) => (
                        <Card key={item.id} variant="outlined">
                          <CardActionArea component={Link} href={`/nodes/schedule/${item.id}`}>
                            <CardContent>
                              <Typography fontWeight={700}>{item.title}</Typography>
                              <Typography color="text.secondary">{item.description || "No description"}</Typography>
                              <Typography variant="body2" color="text.secondary">
                                id: {item.id}
                              </Typography>
                            </CardContent>
                          </CardActionArea>
                        </Card>
                      ))}
                    </Stack>
                  ) : (
                    <Typography color="text.secondary">No schedules.</Typography>
                  )}
                </Grid>
              </Grid>
            </Paper>
          </>
        )}

        {!dataLoading && !error && nodeType === "task" && task && (
          <>
            <Paper variant="outlined" sx={{ p: 2 }}>
              <Typography variant="h6">{task.title}</Typography>
              <Typography color="text.secondary">{task.description || "No description"}</Typography>
              <Typography color="text.secondary">Context: task</Typography>
              <Typography color="text.secondary">id: {task.id}</Typography>
              <Typography color="text.secondary">project: {project?.name ?? `#${task.project_id}`}</Typography>
              <Typography color="text.secondary">company: {company?.name ?? "-"}</Typography>
            </Paper>

            <Paper variant="outlined" sx={{ p: 2 }}>
              <Typography variant="h6" sx={{ mb: 1 }}>
                Document
              </Typography>
              {taskSections.length ? (
                <Stack spacing={1}>
                  {taskSections.map((item) => {
                    const text =
                      item.content && typeof item.content === "object" && !Array.isArray(item.content)
                        ? typeof item.content.text === "string"
                          ? item.content.text
                          : ""
                        : "";
                    return (
                      <Card key={item.id} variant="outlined">
                        <CardActionArea component={Link} href={`/nodes/section/${item.id}`}>
                          <CardContent>
                            <Typography fontWeight={700}>
                              {item.title}{" "}
                              <Typography component="span" variant="body2" color="text.secondary">
                                ({item.key})
                              </Typography>
                            </Typography>
                            <Typography sx={{ whiteSpace: "pre-wrap", mt: 0.5 }}>{text || "No content"}</Typography>
                          </CardContent>
                        </CardActionArea>
                      </Card>
                    );
                  })}
                </Stack>
              ) : (
                <Typography color="text.secondary">No document sections.</Typography>
              )}
            </Paper>
          </>
        )}

        {!dataLoading && !error && nodeType === "schedule" && schedule && (
          <Paper variant="outlined" sx={{ p: 2 }}>
            <Typography variant="h6">{schedule.title}</Typography>
            <Typography color="text.secondary">{schedule.description || "No description"}</Typography>
            <Typography color="text.secondary">Context: schedule</Typography>
            <Typography color="text.secondary">id: {schedule.id}</Typography>
            <Typography color="text.secondary">project: {project?.name ?? `#${schedule.project_id}`}</Typography>
            <Typography color="text.secondary">company: {company?.name ?? "-"}</Typography>
          </Paper>
        )}

        {!dataLoading && !error && nodeType === "section" && section && (
          <Paper variant="outlined" sx={{ p: 2 }}>
            <Typography variant="h6">{section.title}</Typography>
            <Typography color="text.secondary">Context: section</Typography>
            <Typography color="text.secondary">id: {section.id}</Typography>
            <Typography color="text.secondary">key: {section.key}</Typography>
            <Typography color="text.secondary">task: {task?.title ?? `#${section.task_id}`}</Typography>
            <Typography color="text.secondary">project: {project?.name ?? "-"}</Typography>
            <Typography color="text.secondary">company: {company?.name ?? "-"}</Typography>
            <TextField
              label="Section content"
              value={sectionTextDraft}
              onChange={(e) => setSectionTextDraft(e.target.value)}
              minRows={8}
              multiline
              fullWidth
              sx={{ mt: 1.5 }}
            />
            <Button variant="contained" sx={{ mt: 1.5 }} onClick={onSaveSection} disabled={!canSaveSection}>
              {savingSection ? "Saving..." : "Save section"}
            </Button>
          </Paper>
        )}

        {!dataLoading && !error && nodeType === "user" && user && (
          <Paper variant="outlined" sx={{ p: 2 }}>
            <Typography variant="h6">{user.full_name}</Typography>
            <Typography color="text.secondary">{user.email}</Typography>
            <Typography color="text.secondary">id: {user.id}</Typography>
          </Paper>
        )}

        {!dataLoading &&
          !error &&
          ((nodeType === "company" && !company) ||
            (nodeType === "project" && !project) ||
            (nodeType === "task" && !task) ||
            (nodeType === "schedule" && !schedule) ||
            (nodeType === "section" && !section) ||
            (nodeType === "user" && !user)) && <Alert severity="warning">Node not found.</Alert>}
      </Stack>
    </Container>
  );
}
