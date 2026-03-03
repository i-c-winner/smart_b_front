"use client";

import Link from "next/link";

import { LogoutButton } from "@/features/auth/logout/logout-button";
import { useAuth } from "@/shared/lib/auth/auth-context";

export function AppHeader() {
  const { currentUser, token, loading } = useAuth();

  return (
    <header className="app-header">
      <div className="app-header-inner">
        <Link href="/" className="app-header-brand">
          SmartB
        </Link>
        <div className="app-header-right">
          <span className="app-header-user">
            {loading ? "Loading..." : currentUser ? currentUser.full_name : "Guest"}
          </span>
          {token ? (
            <LogoutButton />
          ) : (
            <Link href="/login" className="secondary app-header-login">
              Login
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
