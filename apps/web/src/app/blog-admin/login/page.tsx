import type { Metadata } from "next";
import { LoginForm } from "./LoginForm";

export const metadata: Metadata = {
  title: "Blog admin login — Sundera AI",
  robots: { index: false, follow: false },
};

interface LoginPageProps {
  searchParams: Promise<{ from?: string }>;
}

export default async function BlogAdminLoginPage({ searchParams }: LoginPageProps) {
  const { from } = await searchParams;

  return (
    <div className="flex flex-1 items-center justify-center bg-background px-6 py-16">
      <div className="w-full max-w-sm rounded-3xl border border-foreground/10 bg-card/60 p-8 shadow-lg shadow-black/5 backdrop-blur-xl">
        <h1 className="font-display text-2xl tracking-tight">Blog admin</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Sign in to review, edit, and publish queued blog posts.
        </p>
        <LoginForm from={from ?? ""} />
      </div>
    </div>
  );
}
