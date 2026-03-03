"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

import { LoginForm } from "@/features/auth/login/login-form";
import { useAuth } from "@/shared/lib/auth/auth-context";

export function LoginPage() {
  const router = useRouter();
  const { token, loading } = useAuth();

  useEffect(() => {
    if (!loading && token) {
      router.replace("/");
    }
  }, [loading, token, router]);

  if (loading) {
    return (
      <main>
        <div className="card">Loading session...</div>
      </main>
    );
  }

  return (
    <main>
      <h1>Login</h1>
      <p>Sign in to access dashboard.</p>
      <LoginForm />
    </main>
  );
}
