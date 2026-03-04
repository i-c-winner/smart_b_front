"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";

import {
  getCompanies,
  getProjectUsers,
  getProjects,
  getScheduleByProject,
  getScheduleUsers,
  getTaskSectionPermissions,
  getTaskSections,
  getTasksByProject,
  getTaskUsers,
  getUsers
} from "@/shared/api/domain-api";
import { useAuth } from "@/shared/lib/auth/auth-context";
import { prepareUsersForDisplay } from "@/shared/lib/users/prepare-users-for-display";

type GraphNode = {
  id: string;
  name: string;
  category: number;
  symbolSize: number;
};

type GraphLink = {
  source: string;
  target: string;
  value?: string;
};

function parseNodeId(nodeId: string): { type: string; id: number } | null {
  const [type, rawId] = nodeId.split("-", 2);
  const id = Number(rawId);
  if (!type || Number.isNaN(id)) return null;
  return { type, id };
}

export function HomePage() {
  const router = useRouter();
  const { token, loading } = useAuth();
  const chartRef = useRef<HTMLDivElement | null>(null);
  const chartInstanceRef = useRef<{
    setOption: (option: unknown) => void;
    resize: () => void;
    dispose: () => void;
    dispatchAction: (payload: unknown) => void;
    on: (eventName: string, handler: (params: unknown) => void) => void;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dataLoading, setDataLoading] = useState(false);
  const [nodes, setNodes] = useState<GraphNode[]>([]);
  const [links, setLinks] = useState<GraphLink[]>([]);

  const categories = useMemo(
    () => [
      { name: "Company" },
      { name: "Project" },
      { name: "Task" },
      { name: "Schedule" },
      { name: "User" },
      { name: "Section" }
    ],
    []
  );

  useEffect(() => {
    if (!loading && !token) {
      router.replace("/login");
    }
  }, [loading, token, router]);

  useEffect(() => {
    if (!token) return;

    let active = true;
    const load = async () => {
      setDataLoading(true);
      setError(null);
      try {
        const companies = await getCompanies(token);
        if (!active) return;

        const graphNodes: GraphNode[] = [];
        const graphLinks: GraphLink[] = [];
        const userSet = new Set<string>();

        for (const company of companies) {
          const companyId = `company-${company.id}`;
          graphNodes.push({
            id: companyId,
            name: company.name,
            category: 0,
            symbolSize: 64
          });

          const [projects, companyUsers] = await Promise.all([
            getProjects(token, company.id).catch(() => []),
            getUsers(token, company.id).catch(() => [])
          ]);
          const displayUsers = prepareUsersForDisplay(companyUsers);

          for (const user of displayUsers) {
            const userId = `user-${user.id}`;
            if (!userSet.has(userId)) {
              userSet.add(userId);
              graphNodes.push({
                id: userId,
                name: user.full_name,
                category: 4,
                symbolSize: 40
              });
            }
            graphLinks.push({ source: companyId, target: userId, value: "company" });
          }

          for (const project of projects) {
            const projectId = `project-${project.id}`;
            graphNodes.push({
              id: projectId,
              name: project.name,
              category: 1,
              symbolSize: 52
            });
            graphLinks.push({ source: companyId, target: projectId });

            const projectUsers = await getProjectUsers(token, project.id).catch(() => []);
            for (const role of projectUsers) {
              const userId = `user-${role.id}`;
              if (!userSet.has(userId)) {
                userSet.add(userId);
                graphNodes.push({
                  id: userId,
                  name: role.full_name,
                  category: 4,
                  symbolSize: 40
                });
              }
              graphLinks.push({ source: projectId, target: userId, value: role.role });
            }

            const [tasks, schedules] = await Promise.all([
              getTasksByProject(token, project.id).catch(() => []),
              getScheduleByProject(token, project.id).catch(() => [])
            ]);

            for (const task of tasks) {
              const taskId = `task-${task.id}`;
              graphNodes.push({
                id: taskId,
                name: task.title,
                category: 2,
                symbolSize: 44
              });
              graphLinks.push({ source: projectId, target: taskId });

              const taskRoles = await getTaskUsers(token, task.id).catch(() => []);
              for (const role of taskRoles) {
                const userId = `user-${role.id}`;
                graphLinks.push({ source: userId, target: taskId, value: role.role });
              }

              const sections = await getTaskSections(token, task.id).catch(() => []);
              for (const section of sections) {
                const sectionId = `section-${section.id}`;
                graphNodes.push({
                  id: sectionId,
                  name: section.title,
                  category: 5,
                  symbolSize: 36
                });
                graphLinks.push({ source: taskId, target: sectionId });

                const sectionPerms = await getTaskSectionPermissions(token, task.id, section.id).catch(() => []);
                for (const perm of sectionPerms) {
                  const userId = `user-${perm.user_id}`;
                  graphLinks.push({ source: userId, target: sectionId, value: perm.role });
                }
              }
            }

            for (const schedule of schedules) {
              const scheduleId = `schedule-${schedule.id}`;
              graphNodes.push({
                id: scheduleId,
                name: schedule.title,
                category: 3,
                symbolSize: 44
              });
              graphLinks.push({ source: projectId, target: scheduleId });

              const scheduleRoles = await getScheduleUsers(token, schedule.id).catch(() => []);
              for (const role of scheduleRoles) {
                const userId = `user-${role.id}`;
                graphLinks.push({ source: userId, target: scheduleId, value: role.role });
              }
            }
          }
        }

        if (!active) return;
        setNodes(graphNodes);
        setLinks(graphLinks);
      } catch (err) {
        if (!active) return;
        setError(err instanceof Error ? err.message : "Cannot load graph data");
      } finally {
        if (active) setDataLoading(false);
      }
    };

    load();
    return () => {
      active = false;
    };
  }, [token]);

  useEffect(() => {
    if (!chartRef.current || !nodes.length) return;

    let disposed = false;
    let chart: {
      setOption: (option: unknown) => void;
      resize: () => void;
      dispose: () => void;
      on: (eventName: string, handler: (params: unknown) => void) => void;
      dispatchAction: (payload: unknown) => void;
    } | null = null;

    const init = async () => {
      const echarts = await import("echarts");
      if (!chartRef.current || disposed) return;

      chart = echarts.init(chartRef.current) as unknown as {
        setOption: (option: unknown) => void;
        resize: () => void;
        dispose: () => void;
        on: (eventName: string, handler: (params: unknown) => void) => void;
        dispatchAction: (payload: unknown) => void;
      };
      chartInstanceRef.current = chart;
      chart.setOption({
        tooltip: {},
        legend: [
          {
            data: categories.map((item) => item.name),
            top: 10,
            left: 12,
            itemWidth: 14,
            itemHeight: 10,
            itemGap: 14,
            textStyle: {
              fontSize: 12
            },
            selected: {
              Company: false
            }
          }
        ],
        series: [
          {
            type: "graph",
            layout: "force",
            roam: true,
            draggable: true,
            cursor: "pointer",
            data: nodes,
            links,
            categories,
            force: {
              repulsion: 360,
              edgeLength: 120
            },
            lineStyle: {
              color: "#9aa8b7",
              curveness: 0.12
            },
            emphasis: {
              focus: "adjacency",
              lineStyle: {
                width: 2
              }
            },
            blur: {
              itemStyle: {
                opacity: 0.15
              },
              lineStyle: {
                opacity: 0.08
              },
              label: {
                opacity: 0.15
              }
            },
            label: {
              show: true,
              position: "right",
              formatter: "{b}",
              fontSize: 11
            },
            edgeLabel: {
              show: true,
              formatter: (params: { data?: { value?: string } }) => params.data?.value ?? ""
            }
          }
        ]
      });

      chart.on("click", (params: unknown) => {
        const payload = params as { dataType?: string; data?: { id?: string } };
        if (payload.dataType !== "node" || !payload.data?.id) return;
        const parsed = parseNodeId(payload.data.id);
        if (!parsed) return;
        router.push(`/nodes/${parsed.type}/${parsed.id}`);
      });

      const onResize = () => chart?.resize();
      window.addEventListener("resize", onResize);

      return () => {
        window.removeEventListener("resize", onResize);
      };
    };

    let cleanupResize: (() => void) | undefined;
    init().then((cleanup) => {
      cleanupResize = cleanup;
    });

    return () => {
      disposed = true;
      cleanupResize?.();
      chart?.dispose();
      chartInstanceRef.current = null;
    };
  }, [nodes, links, categories, router]);

  return (
    <main
      style={{
        maxWidth: "none",
        width: "100%",
        padding: "12px 24px",
        height: "calc(100vh - 56px)",
        overflow: "hidden",
        display: "flex",
        flexDirection: "column"
      }}
    >
      <h1>Context Graph</h1>
      {(loading || dataLoading) && <div className="card">Loading graph...</div>}
      {error && <div className="card error">{error}</div>}
      {!dataLoading && !error && (
        <section className="card" style={{ flex: 1, marginBottom: 0, overflow: "hidden" }}>
          <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 8 }}>
            <button
              className="secondary"
              type="button"
              onClick={() => chartInstanceRef.current?.dispatchAction({ type: "restore" })}
            >
              Center graph
            </button>
          </div>
          <div ref={chartRef} style={{ width: "100%", height: "calc(100% - 44px)" }} />
        </section>
      )}
    </main>
  );
}
