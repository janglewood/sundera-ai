import Image from "next/image";

const NAV_LINKS = [
  { href: "#how-it-works", label: "How it works" },
  { href: "#styles", label: "Styles" },
  { href: "#faq", label: "FAQ" },
];

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

        <a
          href="#upload"
          className="rounded-full bg-accent px-4 py-2 text-sm font-semibold text-accent-foreground transition-colors hover:bg-accent-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        >
          Redesign my room
        </a>
      </div>
    </header>
  );
}
