import { House } from "@phosphor-icons/react/dist/ssr";

export function Footer() {
  return (
    <footer className="border-t border-border px-6 py-10 sm:px-8">
      <div className="mx-auto flex w-full max-w-6xl flex-col items-center justify-between gap-4 text-sm text-muted-foreground sm:flex-row">
        <span className="flex items-center gap-2 font-display text-foreground">
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-accent text-accent-foreground">
            <House size={14} weight="fill" />
          </span>
          Sundera AI
        </span>
        <span>&copy; {new Date().getFullYear()} Sundera AI</span>
      </div>
    </footer>
  );
}
