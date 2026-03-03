"use client";

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
    <section className="card">
      <h2>Add User</h2>
      <p>
        Company context: <strong>{companyName}</strong>
      </p>
      <form onSubmit={onSubmit}>
        <label>
          Full name
          <input value={fullName} onChange={(e) => setFullName(e.target.value)} required />
        </label>
        <label>
          Email
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </label>
        <label>
          Password
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
        </label>
        {error && <p className="error">{error}</p>}
        <button className="primary" type="submit" disabled={loading}>
          {loading ? "Creating..." : "Create user"}
        </button>
      </form>
    </section>
  );
}
