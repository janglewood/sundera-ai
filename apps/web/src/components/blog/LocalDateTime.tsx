"use client";

import { useEffect, useState } from "react";

// blog-admin shows scheduled/published timestamps in the viewer's own local
// time, not UTC — the whole point is "is this about to go live soon for me
// right now". A Server Component can't know the browser's timezone, so this
// has to be a client component.
//
// The SSR pass renders in the server's timezone (Railway containers run
// UTC), so the first client render after hydration will legitimately differ
// — suppressHydrationWarning accepts that one-time mismatch instead of
// erroring, and the effect below forces the real client-local value in
// right after mount. This is the standard React pattern for "format a date
// using the viewer's local timezone" — see
// https://react.dev/reference/react-dom/client/hydrateRoot#suppressing-unavoidable-hydration-mismatch-errors.
function formatLocal(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

export function LocalDateTime({ iso }: { iso: string }) {
  const [text, setText] = useState(() => formatLocal(iso));

  useEffect(() => {
    setText(formatLocal(iso));
  }, [iso]);

  return <span suppressHydrationWarning>{text}</span>;
}
