"use client";

import { LogoutButton } from "@/features/auth/logout/logout-button";
import { useAuth } from "@/shared/lib/auth/auth-context";

export function AuthPanel() {
  const { currentUser } = useAuth();
  if (!currentUser) return null;

  return (
    <section className="card">
      <h2>Current user</h2>
      <p>
        <strong>{currentUser.full_name}</strong> ({currentUser.email})
      </p>
      <span className="badge">id: {currentUser.id}</span>
      <div style={{ marginTop: 12 }}>
        <LogoutButton />
      </div>
    </section>
  );
}
