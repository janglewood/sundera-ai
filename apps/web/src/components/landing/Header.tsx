"use client";

import Image from "next/image";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { highlightUpload } from "@/lib/highlightUpload";
import { useAuth } from "@/lib/auth/auth-context";
import { signOutUser } from "@/lib/auth/auth-actions";
import { LanguageSwitcher } from "@/components/shared/LanguageSwitcher";

function AccountControls() {
  const t = useTranslations("Nav");
  const { user, loading } = useAuth();

  if (loading) return null;

  if (!user) {
    return (
      <Link
        href="/login"
        className="rounded-full px-2 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground sm:px-3 sm:py-2 sm:text-sm"
      >
        {t("signIn")}
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
        className="rounded-full px-2 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground sm:px-3 sm:py-2 sm:text-sm"
      >
        • {t("signOut")}
      </button>
    </div>
  );
}

export function Header() {
  const t = useTranslations("Nav");

  const navLinks = [
    { href: "/#how-it-works", label: t("howItWorks") },
    { href: "/#reviews", label: t("reviews") },
    { href: "/#pricing", label: t("pricing") },
    { href: "/#faq", label: t("faq") },
    { href: "/blog", label: t("blog") },
  ];

  return (
    <header className="sticky top-0 z-30 border-b border-white/30 bg-card/40 backdrop-blur-xl">
      <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-3 sm:px-8">
        <Link href="/" className="flex items-center">
          <Image
            src="/logo.png"
            alt="Sundera AI"
            width={800}
            height={162}
            priority
            className="h-6 w-auto sm:h-8"
          />
        </Link>

        <nav className="hidden items-center gap-8 text-sm font-medium text-muted-foreground sm:flex">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="rounded transition-colors hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent"
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          <LanguageSwitcher />
          <AccountControls />

          <Link
            href="/#upload"
            onClick={highlightUpload}
            className="rounded-full bg-accent bg-linear-to-br from-accent to-accent-hover px-3 py-1.5 text-xs font-semibold text-accent-foreground shadow-lg shadow-accent/30 transition-colors hover:bg-accent-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent sm:bg-none sm:px-4 sm:py-2 sm:text-sm sm:shadow-none"
          >
            {t("redesignMyRoom")}
          </Link>
        </div>
      </div>
    </header>
  );
}
