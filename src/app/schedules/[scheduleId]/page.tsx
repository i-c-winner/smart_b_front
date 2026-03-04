"use client";

import { Alert, CircularProgress, Container, Paper, Stack, Typography } from "@mui/material";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";

import {
  getProject,
  getSchedule,
  getScheduleByProject,
  getTask,
  getTaskSectionPermissions,
  getTaskSections,
  getUsers
} from "@/shared/api/domain-api";
import { useAuth } from "@/shared/lib/auth/auth-context";
import type { Schedule, Task, TaskSection, User } from "@/shared/types/domain";

type ChartBoxProps = {
  title: string;
  subtitle?: string;
  plannedStart: string | null;
  plannedEnd: string | null;
  actualStart: string | null;
  actualEnd: string | null;
};

function formatDate(value: string | null): string {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString();
}

function toTimestamp(value: string | null): number | null {
  if (!value) return null;
  const time = new Date(value).getTime();
  return Number.isNaN(time) ? null : time;
}

function ScheduleDateChart({ title, subtitle, plannedStart, plannedEnd, actualStart, actualEnd }: ChartBoxProps) {
  const chartRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!chartRef.current) return;

    let disposed = false;
    let chart: {
      setOption: (option: unknown) => void;
      resize: () => void;
      dispose: () => void;
    } | null = null;

    const init = async () => {
      const echarts = await import("echarts");
      if (!chartRef.current || disposed) return;
      chart = echarts.init(chartRef.current) as unknown as {
        setOption: (option: unknown) => void;
        resize: () => void;
        dispose: () => void;
      };

      const plannedStartTs = toTimestamp(plannedStart);
      const plannedEndTs = toTimestamp(plannedEnd);
      const actualStartTs = toTimestamp(actualStart);
      const actualEndTs = toTimestamp(actualEnd);

      const ranges = [
        {
          label: "planned",
          start: plannedStartTs,
          end: plannedEndTs ?? plannedStartTs,
          color: "#1976d2"
        },
        {
          label: "actual",
          start: actualStartTs,
          end: actualEndTs ?? actualStartTs,
          color: "#2e7d32"
        }
      ];

      const hasAnyRange = ranges.some((range) => range.start !== null && range.end !== null);
      const fallbackNow = Date.now();
      const starts = ranges
        .map((range) => range.start)
        .filter((value): value is number => value !== null);
      const ends = ranges
        .map((range) => range.end)
        .filter((value): value is number => value !== null);
      const minAxis = starts.length ? Math.min(...starts) : fallbackNow - 3_600_000;
      const maxAxis = ends.length ? Math.max(...ends) : fallbackNow + 3_600_000;
      const pad = Math.max(300_000, Math.floor((maxAxis - minAxis) * 0.1));

      const baseData = ranges.map((range) => range.start);
      const durationData = ranges.map((range) => {
        if (range.start === null || range.end === null) return null;
        return Math.max(60_000, range.end - range.start);
      });

      chart.setOption({
        title: {
          text: title,
          subtext: subtitle ?? "",
          left: 8,
          top: 8,
          textStyle: { fontSize: 14 },
          subtextStyle: { fontSize: 12 }
        },
        grid: {
          left: 84,
          right: 24,
          top: 56,
          bottom: 36
        },
        tooltip: {
          trigger: "item",
          formatter: (params: { dataIndex?: number }) => {
            const index = params.dataIndex ?? 0;
            const range = ranges[index];
            if (!range) return "";
            return `${range.label}<br/>start: ${formatDate(
              range.start ? new Date(range.start).toISOString() : null
            )}<br/>end: ${formatDate(range.end ? new Date(range.end).toISOString() : null)}`;
          }
        },
        xAxis: {
          type: "time",
          min: minAxis - pad,
          max: maxAxis + pad,
          axisLabel: {
            formatter: (value: number) => formatDate(new Date(value).toISOString())
          }
        },
        yAxis: {
          type: "category",
          data: ranges.map((range) => range.label)
        },
        series: [
          {
            type: "bar",
            stack: "timeline",
            silent: true,
            barWidth: 22,
            itemStyle: { color: "rgba(0,0,0,0)" },
            emphasis: { disabled: true },
            data: baseData
          },
          {
            type: "bar",
            stack: "timeline",
            barWidth: 22,
            data: durationData,
            itemStyle: {
              color: (params: { dataIndex: number }) => ranges[params.dataIndex]?.color ?? "#1976d2",
              borderRadius: 4
            },
            label: {
              show: !hasAnyRange,
              formatter: () => "no dates",
              position: "inside"
            }
          }
        ]
      });

      const onResize = () => chart?.resize();
      window.addEventListener("resize", onResize);
      return () => window.removeEventListener("resize", onResize);
    };

    let cleanupResize: (() => void) | undefined;
    init().then((cleanup) => {
      cleanupResize = cleanup;
    });

    return () => {
      disposed = true;
      cleanupResize?.();
      chart?.dispose();
    };
  }, [title, subtitle, plannedStart, plannedEnd, actualStart, actualEnd]);

  return <div ref={chartRef} style={{ width: "100%", height: 260 }} />;
}

export default function ScheduleDetailsPage() {
  const params = useParams<{ scheduleId: string }>();
  const router = useRouter();
  const { token, loading } = useAuth();

  const scheduleId = useMemo(() => Number(params?.scheduleId), [params?.scheduleId]);

  const [taskSchedule, setTaskSchedule] = useState<Schedule | null>(null);
  const [task, setTask] = useState<Task | null>(null);
  const [sections, setSections] = useState<TaskSection[]>([]);
  const [sectionSchedules, setSectionSchedules] = useState<Record<number, Schedule>>({});
  const [sectionEditors, setSectionEditors] = useState<Record<number, string>>({});

  const [dataLoading, setDataLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && !token) {
      router.replace("/login");
    }
  }, [loading, token, router]);

  useEffect(() => {
    if (!token || !Number.isFinite(scheduleId)) return;
    let active = true;

    const load = async () => {
      setDataLoading(true);
      setError(null);

      try {
        const schedule = await getSchedule(token, scheduleId);
        if (!active) return;

        if (!schedule.task_id) {
          setTaskSchedule(schedule);
          setTask(null);
          setSections([]);
          setSectionSchedules({});
          setSectionEditors({});
          setError("This schedule is not attached to task-level context.");
          return;
        }

        const taskData = await getTask(token, schedule.task_id);
        const project = await getProject(token, taskData.project_id);

        const [projectSchedules, taskSections, companyUsers] = await Promise.all([
          getScheduleByProject(token, taskData.project_id),
          getTaskSections(token, taskData.id),
          getUsers(token, project.company_id)
        ]);

        const sectionScheduleMap: Record<number, Schedule> = {};
        for (const item of projectSchedules) {
          if (item.section_id) {
            sectionScheduleMap[item.section_id] = item;
          }
        }

        const userById = new Map<number, User>(companyUsers.map((user) => [user.id, user]));
        const sectionEditorMap: Record<number, string> = {};

        await Promise.all(
          taskSections.map(async (section) => {
            const perms = await getTaskSectionPermissions(token, taskData.id, section.id).catch(() => []);
            const editors = perms
              .filter((perm) => perm.role === "section_editor")
              .map((perm) => userById.get(perm.user_id)?.full_name ?? perm.full_name)
              .filter(Boolean);
            sectionEditorMap[section.id] = editors.length ? editors.join(", ") : "-";
          })
        );

        if (!active) return;
        setTaskSchedule(schedule);
        setTask(taskData);
        setSections(taskSections);
        setSectionSchedules(sectionScheduleMap);
        setSectionEditors(sectionEditorMap);
      } catch (err) {
        if (!active) return;
        setError(err instanceof Error ? err.message : "Cannot load schedule details");
      } finally {
        if (active) setDataLoading(false);
      }
    };

    load();
    return () => {
      active = false;
    };
  }, [token, scheduleId]);

  return (
    <Container maxWidth="xl" sx={{ py: 2 }}>
      <Stack spacing={2}>
        <Typography variant="h4">Task Schedule Details</Typography>

        {(loading || dataLoading) && (
          <Stack direction="row" spacing={1.5} alignItems="center">
            <CircularProgress size={20} />
            <Typography>Loading...</Typography>
          </Stack>
        )}

        {error && <Alert severity="error">{error}</Alert>}

        {!loading && !dataLoading && taskSchedule && (
          <Paper variant="outlined" sx={{ p: 2 }}>
            <Typography variant="h6" sx={{ mb: 1 }}>
              Common Task Schedule
            </Typography>
            <Typography variant="body2" sx={{ mb: 1 }}>
              Task: {task?.title ?? "-"}
            </Typography>
            <ScheduleDateChart
              title={taskSchedule.title}
              subtitle={`schedule #${taskSchedule.id}`}
              plannedStart={taskSchedule.planned_start_at}
              plannedEnd={taskSchedule.planned_end_at}
              actualStart={taskSchedule.actual_start_at}
              actualEnd={taskSchedule.actual_end_at}
            />
          </Paper>
        )}

        {!loading && !dataLoading && !!sections.length && (
          <Paper variant="outlined" sx={{ p: 2 }}>
            <Typography variant="h6" sx={{ mb: 1 }}>
              Sections Schedules
            </Typography>
            <Stack spacing={2}>
              {sections.map((section) => {
                const sectionSchedule = sectionSchedules[section.id];
                return (
                  <Paper key={section.id} variant="outlined" sx={{ p: 1.5 }}>
                    <ScheduleDateChart
                      title={section.title}
                      subtitle={`section_editor: ${sectionEditors[section.id] ?? "-"}`}
                      plannedStart={sectionSchedule?.planned_start_at ?? null}
                      plannedEnd={sectionSchedule?.planned_end_at ?? null}
                      actualStart={sectionSchedule?.actual_start_at ?? null}
                      actualEnd={sectionSchedule?.actual_end_at ?? null}
                    />
                  </Paper>
                );
              })}
            </Stack>
          </Paper>
        )}
      </Stack>
    </Container>
  );
}
