export function Footer() {
  return (
    <footer className="border-t border-border px-6 py-10 sm:px-8">
      <div className="mx-auto flex w-full max-w-6xl flex-col items-center justify-center gap-4 text-sm text-muted-foreground sm:flex-row sm:justify-between">
        <span>&copy; {new Date().getFullYear()} Sundera AI</span>
        <a
          href="https://tools.launchllama.co?utm_source=badge&utm_medium=referral"
          target="_blank"
          rel="noopener noreferrer"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="https://tools.launchllama.co/featured-badge.png?v=2"
            alt="As seen on Launch Llama Newsletter"
            width={200}
            height={50}
          />
        </a>
      </div>
    </footer>
  );
}
