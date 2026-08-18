"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { List } from "@phosphor-icons/react";
import { useAuth } from "@/lib/auth/auth-context";
import { AppSidebar } from "@/components/app/AppSidebar";
import { AccountMenu } from "@/components/app/AccountMenu";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [hasSidebar, setHasSidebar] = useState(false);

  useEffect(() => {
    if (!loading && !user) {
      router.replace("/");
    }
  }, [loading, user, router]);

  if (loading || !user) {
    return null;
  }

  return (
    <div className="relative flex flex-1">
      <AppSidebar
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        onEmptyChange={(empty) => setHasSidebar(!empty)}
      />
      {hasSidebar && (
        <button
          type="button"
          onClick={() => setSidebarOpen(true)}
          aria-label="Open menu"
          className="absolute top-4 left-4 z-10 rounded-full border border-foreground/10 bg-background p-2 md:hidden"
        >
          <List className="size-5" />
        </button>
      )}
      <div className="absolute top-4 right-4 z-10">
        <AccountMenu />
      </div>
      <main className="flex-1 overflow-y-auto">{children}</main>
    </div>
  );
}
