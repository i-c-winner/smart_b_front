"use client";

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
    <section className="card">
      <h2>Create Project</h2>
      <p>
        Current company: <strong>{companyName}</strong>
      </p>
      <form onSubmit={onSubmit}>
        <label>
          Project name
          <input value={name} onChange={(e) => setName(e.target.value)} required />
        </label>
        {error && <p className="error">{error}</p>}
        <button className="primary" type="submit" disabled={loading}>
          {loading ? "Creating..." : "Add project"}
        </button>
      </form>
    </section>
  );
}
