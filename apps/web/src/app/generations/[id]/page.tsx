import { GenerationView } from "@/components/generation/GenerationView";

export default async function GenerationPage(
  props: PageProps<"/generations/[id]">,
) {
  const { id } = await props.params;

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col justify-center gap-10 px-6 py-16">
      <GenerationView id={id} />
    </main>
  );
}
