"use client";

import { ChatCircleDots, X } from "@phosphor-icons/react/dist/ssr";
import { useState } from "react";
import { useAuth } from "@/lib/auth/auth-context";
import { submitFeedback } from "@/lib/feedback";

export function FeedbackWidget() {
  const { user } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSent, setIsSent] = useState(false);

  function open() {
    setEmail(user?.email ?? "");
    setMessage("");
    setError(null);
    setIsSent(false);
    setIsOpen(true);
  }

  async function handleSubmit() {
    setIsSubmitting(true);
    setError(null);
    try {
      await submitFeedback(email, message);
      setIsSent(true);
    } catch {
      setError("Couldn't send your message. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={open}
        aria-label="Send feedback"
        className="fixed right-4 bottom-4 z-40 flex h-12 w-12 items-center justify-center rounded-full bg-foreground text-background shadow-lg transition-transform hover:scale-105 sm:right-6 sm:bottom-6"
      >
        <ChatCircleDots size={22} weight="bold" />
      </button>

      {isOpen && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-4 backdrop-blur-sm sm:items-center"
          onClick={() => setIsOpen(false)}
          role="dialog"
          aria-modal="true"
          aria-label="Send feedback"
        >
          <div
            className="relative w-full max-w-sm rounded-3xl border border-white/40 bg-card p-6 shadow-2xl sm:p-8"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              aria-label="Close"
              className="absolute top-4 right-4 rounded-full p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              <X size={18} weight="bold" />
            </button>

            {isSent ? (
              <div className="flex flex-col items-center gap-3 py-6 text-center">
                <h2 className="font-display text-xl">Thanks!</h2>
                <p className="text-sm text-foreground/60">
                  We got your message and will follow up if needed.
                </p>
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  className="mt-2 rounded-full bg-foreground px-6 py-2.5 text-sm font-medium text-background"
                >
                  Close
                </button>
              </div>
            ) : (
              <form
                className="flex flex-col gap-4"
                onSubmit={(e) => {
                  e.preventDefault();
                  void handleSubmit();
                }}
              >
                <div>
                  <h2 className="font-display text-xl">Send feedback</h2>
                  <p className="mt-1 text-sm text-foreground/60">
                    Questions, bugs, ideas — we read everything.
                  </p>
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium" htmlFor="feedback-email">
                    Email
                  </label>
                  <input
                    id="feedback-email"
                    type="email"
                    autoComplete="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full rounded-xl border border-foreground/20 bg-transparent p-3 text-sm"
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium" htmlFor="feedback-message">
                    What&apos;s on your mind?
                  </label>
                  <textarea
                    id="feedback-message"
                    required
                    rows={4}
                    maxLength={2000}
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    className="w-full resize-none rounded-xl border border-foreground/20 bg-transparent p-3 text-sm"
                  />
                </div>

                {error && <p className="text-sm text-red-500">{error}</p>}

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="rounded-full bg-foreground px-6 py-3 font-medium text-background transition-opacity disabled:opacity-40"
                >
                  {isSubmitting ? "Sending…" : "Send"}
                </button>
              </form>
            )}
          </div>
        </div>
      )}
    </>
  );
}
