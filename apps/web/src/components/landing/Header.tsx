"use client";

import Image from "next/image";
import Link from "next/link";
import { highlightUpload } from "@/lib/highlightUpload";
import { useAuth } from "@/lib/auth/auth-context";
import { signOutUser } from "@/lib/auth/auth-actions";

const NAV_LINKS = [
  { href: "#how-it-works", label: "How it works" },
  { href: "#styles", label: "Styles" },
  { href: "#faq", label: "FAQ" },
];

function AccountControls() {
  const { user, loading } = useAuth();

  if (loading) return null;

  if (!user) {
    return (
      <Link
        href="/login"
        className="rounded-full px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
      >
        Sign in
      </Link>
    );
  }

  return (
    <div className="flex items-center gap-3 text-sm">
      <span className="hidden text-muted-foreground sm:inline">
        {user.displayName ?? user.email}
      </span>
      <button
        type="button"
        onClick={() => void signOutUser()}
        className="rounded-full px-3 py-2 font-medium text-muted-foreground transition-colors hover:text-foreground"
      >
        Sign out
      </button>
    </div>
  );
}

export function Header() {
  return (
    <header className="sticky top-0 z-30 border-b border-white/30 bg-card/40 backdrop-blur-xl dark:border-white/10">
      <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-3 sm:px-8">
        <a href="#top" className="flex items-center">
          <Image
            src="/logo.png"
            alt="Sundera AI"
            width={800}
            height={162}
            priority
            className="h-8 w-auto"
          />
        </a>

        <nav className="hidden items-center gap-8 text-sm font-medium text-muted-foreground sm:flex">
          {NAV_LINKS.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="rounded transition-colors hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent"
            >
              {link.label}
            </a>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          <AccountControls />

          <a
            href="#upload"
            onClick={highlightUpload}
            className="rounded-full bg-accent bg-linear-to-br from-accent to-accent-hover px-4 py-2 text-sm font-semibold text-accent-foreground shadow-lg shadow-accent/30 transition-colors hover:bg-accent-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent sm:bg-none sm:shadow-none"
          >
            Redesign my room
          </a>
        </div>
      </div>
    </header>
  );
}
