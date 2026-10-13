"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { useEffect } from "react";
import { track } from "./posthog";

export function PostHogPageView() {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    if (!pathname) return;
    const search = searchParams.toString();
    const url = search ? `${pathname}?${search}` : pathname;
    track("$pageview", { $current_url: `${window.location.origin}${url}` });
  }, [pathname, searchParams]);

  return null;
}
