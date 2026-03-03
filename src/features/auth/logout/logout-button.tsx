"use client";

import { useRouter } from "next/navigation";
import { useAuth } from "@/shared/lib/auth/auth-context";

export function LogoutButton() {
  const router = useRouter();
  const { logout } = useAuth();

  return (
    <button
      className="secondary"
      onClick={() => {
        logout();
        router.replace("/login");
      }}
      type="button"
    >
      Logout
    </button>
  );
}
