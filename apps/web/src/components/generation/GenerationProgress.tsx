const STEPS: Record<string, string> = {
  PENDING: "Queued for generation…",
  PROCESSING: "Redesigning your room…",
};

interface GenerationProgressProps {
  status: "PENDING" | "PROCESSING";
}

export function GenerationProgress({ status }: GenerationProgressProps) {
  return (
    <div className="flex flex-col items-center gap-4 py-16 text-center">
      <div className="h-10 w-10 animate-spin rounded-full border-2 border-foreground/20 border-t-foreground" />
      <p className="text-lg font-medium">{STEPS[status]}</p>
      <p className="text-sm text-foreground/60">
        This usually takes 15–20 seconds.
      </p>
    </div>
  );
}
