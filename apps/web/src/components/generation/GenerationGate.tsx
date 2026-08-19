"use client";

import { GoogleLogo } from "@phosphor-icons/react";
import { useState } from "react";
import {
  getAuthErrorMessage,
  signInWithEmail,
  signInWithGoogle,
  signUpWithEmail,
} from "@/lib/auth/auth-actions";

type Mode = "signin" | "signup";

export function GenerationGate() {
  const [mode, setMode] = useState<Mode>("signup");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit() {
    setIsSubmitting(true);
    setError(null);
    try {
      if (mode === "signup") {
        await signUpWithEmail(email, password);
      } else {
        await signInWithEmail(email, password);
      }
      // No redirect: the parent re-renders into the real form once auth state updates.
    } catch (err) {
      setError(getAuthErrorMessage(err));
      setIsSubmitting(false);
    }
  }

  async function handleGoogle() {
    setIsSubmitting(true);
    setError(null);
    try {
      await signInWithGoogle();
    } catch (err) {
      setError(getAuthErrorMessage(err));
      setIsSubmitting(false);
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-sm flex-col gap-8 px-6 py-16">
      <div className="flex flex-col items-center gap-3 text-center">
        <div className="h-10 w-10 animate-spin rounded-full border-2 border-foreground/20 border-t-foreground" />
        <div>
          <p className="text-lg font-medium">Getting your redesign ready…</p>
          <p className="mt-1 text-sm text-foreground/60">
            Create a free account to pick a style and see your room
            transformed.
          </p>
        </div>
      </div>

      <div className="flex flex-col gap-4 rounded-2xl border border-foreground/10 p-6">
        <h2 className="text-base font-semibold">
          {mode === "signin" ? "Sign in" : "Create your account"}
        </h2>

        <form
          className="flex flex-col gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            void handleSubmit();
          }}
        >
          <div>
            <label
              className="mb-2 block text-sm font-medium"
              htmlFor="gate-email"
            >
              Email
            </label>
            <input
              id="gate-email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-xl border border-foreground/20 bg-transparent p-3 text-sm"
            />
          </div>

          <div>
            <label
              className="mb-2 block text-sm font-medium"
              htmlFor="gate-password"
            >
              Password
            </label>
            <input
              id="gate-password"
              type="password"
              autoComplete={mode === "signin" ? "current-password" : "new-password"}
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-xl border border-foreground/20 bg-transparent p-3 text-sm"
            />
          </div>

          {error && <p className="text-sm text-red-500">{error}</p>}

          <button
            type="submit"
            disabled={isSubmitting}
            className="rounded-full bg-foreground px-6 py-3 font-medium text-background transition-opacity disabled:opacity-40"
          >
            {isSubmitting
              ? "Please wait…"
              : mode === "signin"
                ? "Sign in"
                : "Create account"}
          </button>
        </form>

        <div className="flex items-center gap-3 text-xs text-foreground/40">
          <div className="h-px flex-1 bg-foreground/10" />
          or
          <div className="h-px flex-1 bg-foreground/10" />
        </div>

        <button
          type="button"
          onClick={() => void handleGoogle()}
          disabled={isSubmitting}
          className="flex items-center justify-center gap-2 rounded-full border border-foreground/20 px-6 py-3 text-sm font-medium transition-opacity disabled:opacity-40"
        >
          <GoogleLogo weight="bold" className="h-4 w-4" />
          Continue with Google
        </button>

        <button
          type="button"
          onClick={() => {
            setError(null);
            setMode(mode === "signin" ? "signup" : "signin");
          }}
          className="text-center text-sm text-foreground/60 underline underline-offset-4"
        >
          {mode === "signin"
            ? "Need an account? Sign up"
            : "Already have an account? Sign in"}
        </button>
      </div>
    </div>
  );
}
