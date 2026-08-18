export function Footer() {
  return (
    <footer className="border-t border-border px-6 py-10 sm:px-8">
      <div className="mx-auto flex w-full max-w-6xl items-center justify-center text-sm text-muted-foreground">
        <span>&copy; {new Date().getFullYear()} Sundera AI</span>
      </div>
    </footer>
  );
}
