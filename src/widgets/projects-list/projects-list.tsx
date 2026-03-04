"use client";

import {
  Alert,
  Box,
  Button,
  Card,
  CardActionArea,
  CardContent,
  FormControl,
  Grid,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Stack,
  Typography
} from "@mui/material";
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
    <Paper component="section" variant="outlined" sx={{ p: 2 }}>
      <Stack spacing={2}>
        <Typography variant="h6">Projects</Typography>
        {error && <Alert severity="error">{error}</Alert>}
        {!projects.length && <Typography color="text.secondary">No projects found.</Typography>}
        <Grid container spacing={1.5}>
          {projects.map((project) => (
            <Grid size={{ xs: 12, sm: 6, md: 4 }} key={project.id}>
              <Card variant="outlined">
                <CardActionArea onClick={() => router.push(`/settings/projects/${project.id}`)}>
                  <CardContent>
                    <Typography variant="subtitle1" fontWeight={700}>
                      {project.name}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      company_id: {project.company_id}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      id: {project.id}
                    </Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                      <strong>Current admins:</strong>{" "}
                      {adminsByProject[project.id]?.length
                        ? adminsByProject[project.id].map((admin) => admin.full_name).join(", ")
                        : "none"}
                    </Typography>
                  </CardContent>
                </CardActionArea>
                <Box sx={{ p: 1.5, pt: 0 }}>
                  <Stack direction="row" spacing={1} onClick={(e) => e.stopPropagation()}>
                    <FormControl fullWidth size="small">
                      <InputLabel>Select user</InputLabel>
                      <Select
                        label="Select user"
                        value={selectedByProject[project.id] ?? ""}
                        onChange={(e) =>
                          setSelectedByProject((prev) => ({
                            ...prev,
                            [project.id]: String(e.target.value)
                          }))
                        }
                      >
                        <MenuItem value="">Select company user</MenuItem>
                        {companyUsers.map((user) => (
                          <MenuItem key={user.id} value={String(user.id)}>
                            {user.full_name} ({user.email})
                          </MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                    <Button
                      variant="outlined"
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
                    </Button>
                  </Stack>
                </Box>
              </Card>
            </Grid>
          ))}
        </Grid>
      </Stack>
    </Paper>
  );
}
