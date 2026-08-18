"use client";

import { useAuth } from "@/lib/auth/auth-context";
import { signOutUser } from "@/lib/auth/auth-actions";

export function AccountMenu() {
  const { user } = useAuth();

  return (
    <div className="flex items-center gap-3 text-sm">
      <span className="max-w-[12rem] truncate text-foreground/60">
        {user?.displayName ?? user?.email}
      </span>
      <button
        type="button"
        onClick={() => void signOutUser()}
        className="shrink-0 font-medium text-foreground/60 hover:text-foreground"
      >
        Sign out
      </button>
    </div>
  );
}
