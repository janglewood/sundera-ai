"use client";

import { GoogleLogo } from "@phosphor-icons/react";
import type { UserCredential } from "firebase/auth";
import { useState } from "react";
import {
  continueWithEmail,
  getAuthErrorMessage,
  signInWithGoogle,
} from "@/lib/auth/auth-actions";
import {
  clearAnonGenerationIds,
  getAnonGenerationIds,
} from "@/lib/anon-generations";
import { claimGenerations } from "@/lib/generations";

interface AuthFormProps {
  title: string;
  subtitle: string;
  onSuccess: (credential: UserCredential) => void;
}

export function AuthForm({ title, subtitle, onSuccess }: AuthFormProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function claimAnonGenerations() {
    const ids = getAnonGenerationIds();
    if (ids.length === 0) return;
    try {
      await claimGenerations(ids);
      clearAnonGenerationIds();
    } catch {
      // best-effort — a failed claim shouldn't block sign-in completing
    }
  }

  async function handleSubmit() {
    setIsSubmitting(true);
    setError(null);
    try {
      const credential = await continueWithEmail(email, password);
      await claimAnonGenerations();
      onSuccess(credential);
    } catch (err) {
      setError(getAuthErrorMessage(err));
      setIsSubmitting(false);
    }
  }

  async function handleGoogle() {
    setIsSubmitting(true);
    setError(null);
    try {
      const credential = await signInWithGoogle();
      await claimAnonGenerations();
      onSuccess(credential);
    } catch (err) {
      setError(getAuthErrorMessage(err));
      setIsSubmitting(false);
    }
  }

  return (
    <div className="flex w-full flex-col gap-8">
      <div>
        <h1 className="font-display text-2xl">{title}</h1>
        <p className="mt-1 text-sm text-foreground/60">{subtitle}</p>
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
            autoComplete="current-password"
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
          {isSubmitting ? "Please wait…" : "Continue"}
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
    </div>
  );
}
