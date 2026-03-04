"use client";

import { Alert, Button, Paper, Stack, TextField, Typography } from "@mui/material";
import { FormEvent, useState } from "react";

type Props = {
  companyName: string;
  onCreate: (name: string) => Promise<void>;
};

export function CreateProjectForm({ companyName, onCreate }: Props) {
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!name.trim()) {
      setError("Project name is required");
      return;
    }
    setError(null);
    setLoading(true);
    try {
      await onCreate(name.trim());
      setName("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Cannot create project");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Paper component="section" variant="outlined" sx={{ p: 2 }}>
      <Stack spacing={2}>
        <Typography variant="h6">Create Project</Typography>
        <Typography variant="body2" color="text.secondary">
          Current company: <strong>{companyName}</strong>
        </Typography>
        <Stack component="form" onSubmit={onSubmit} spacing={2}>
          <TextField label="Project name" value={name} onChange={(e) => setName(e.target.value)} required fullWidth />
          {error && <Alert severity="error">{error}</Alert>}
          <Button variant="contained" type="submit" disabled={loading}>
            {loading ? "Creating..." : "Add project"}
          </Button>
        </Stack>
      </Stack>
    </Paper>
  );
}
