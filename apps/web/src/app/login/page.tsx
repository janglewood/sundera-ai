"use client";

import { GoogleLogo } from "@phosphor-icons/react";
import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/lib/auth/auth-context";
import {
  getAuthErrorMessage,
  signInWithEmail,
  signInWithGoogle,
  signUpWithEmail,
} from "@/lib/auth/auth-actions";

type Mode = "signin" | "signup";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, loading } = useAuth();

  const destination =
    searchParams.get("next") === "paywall" ? "/app?openPaywall=1" : "/app";

  const [mode, setMode] = useState<Mode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && user) {
      router.replace(destination);
    }
  }, [loading, user, router, destination]);

  async function handleSubmit() {
    setIsSubmitting(true);
    setError(null);
    try {
      if (mode === "signup") {
        await signUpWithEmail(email, password);
      } else {
        await signInWithEmail(email, password);
      }
      router.push(destination);
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
      router.push(destination);
    } catch (err) {
      setError(getAuthErrorMessage(err));
      setIsSubmitting(false);
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center gap-8 px-6 py-16">
      <div>
        <h1 className="font-display text-2xl">
          {mode === "signin" ? "Sign in" : "Create your account"}
        </h1>
        <p className="mt-1 text-sm text-foreground/60">
          {mode === "signin"
            ? "Welcome back to Sundera."
            : "Save and revisit your redesigns."}
        </p>
      </div>

      <form
        className="flex flex-col gap-4"
        onSubmit={(e) => {
          e.preventDefault();
          void handleSubmit();
        }}
      >
        <div>
          <label className="mb-2 block text-sm font-medium" htmlFor="email">
            Email
          </label>
          <input
            id="email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded-xl border border-foreground/20 bg-transparent p-3 text-sm"
          />
        </div>

        <div>
          <label className="mb-2 block text-sm font-medium" htmlFor="password">
            Password
          </label>
          <input
            id="password"
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

      <div className="flex flex-col gap-3">
        <button
          type="button"
          onClick={() => void handleGoogle()}
          disabled={isSubmitting}
          className="flex items-center justify-center gap-2 rounded-full border border-foreground/20 px-6 py-3 text-sm font-medium transition-opacity disabled:opacity-40"
        >
          <GoogleLogo weight="bold" className="h-4 w-4" />
          Continue with Google
        </button>
      </div>

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
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
