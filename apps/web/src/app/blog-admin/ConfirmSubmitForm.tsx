"use client";

import type { ReactNode } from "react";

// Server actions can't ask `confirm()` themselves (no DOM on the server), so
// publishing — a one-way trip, see BlogPostsService.publishNow — gets this
// thin client wrapper purely to intercept the submit and confirm first.
export function ConfirmSubmitForm({
  action,
  confirmMessage,
  className,
  children,
}: {
  action: () => void | Promise<void>;
  confirmMessage: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <form
      action={action}
      className={className}
      onSubmit={(event) => {
        if (!window.confirm(confirmMessage)) {
          event.preventDefault();
        }
      }}
    >
      {children}
    </form>
  );
}
