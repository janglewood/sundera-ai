import Link from "next/link";
import { GenerationView } from "@/components/generation/GenerationView";

export default async function GenerationPage(
  props: PageProps<"/generations/[id]">,
) {
  const { id } = await props.params;

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col justify-center gap-10 px-6 py-16">
      <Link
        href="/app"
        className="flex items-center gap-1 self-start text-sm text-foreground/60 transition-colors hover:text-foreground"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="m15 18-6-6 6-6" />
        </svg>
        Back
      </Link>
      <GenerationView id={id} />
    </main>
  );
}
