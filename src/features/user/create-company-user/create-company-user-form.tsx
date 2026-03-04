"use client";

import { Alert, Button, Paper, Stack, TextField, Typography } from "@mui/material";
import { FormEvent, useState } from "react";

type Props = {
  companyName: string;
  onCreate: (payload: { email: string; full_name: string; password: string }) => Promise<void>;
};

export function CreateCompanyUserForm({ companyName, onCreate }: Props) {
  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await onCreate({ email, full_name: fullName, password });
      setEmail("");
      setFullName("");
      setPassword("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Cannot create user");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Paper component="section" variant="outlined" sx={{ p: 2 }}>
      <Stack spacing={2}>
        <Typography variant="h6">Add User</Typography>
        <Typography variant="body2" color="text.secondary">
          Company context: <strong>{companyName}</strong>
        </Typography>
        <Stack component="form" onSubmit={onSubmit} spacing={2}>
          <TextField label="Full name" value={fullName} onChange={(e) => setFullName(e.target.value)} required fullWidth />
          <TextField label="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required fullWidth />
          <TextField
            label="Password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            fullWidth
          />
          {error && <Alert severity="error">{error}</Alert>}
          <Button variant="contained" type="submit" disabled={loading}>
            {loading ? "Creating..." : "Create user"}
          </Button>
        </Stack>
      </Stack>
    </Paper>
  );
}
