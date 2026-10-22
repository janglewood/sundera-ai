"use client";

import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { useRouter } from "@/i18n/navigation";
import { BeforeAfterSlider } from "@/components/generation/BeforeAfterSlider";
import { PhotoDropzone } from "@/components/upload/PhotoDropzone";
import { createUpload } from "@/lib/generations";
import { Parallax } from "@/components/landing/Parallax";
import { track } from "@/lib/analytics/posthog";

export function Hero() {
  const t = useTranslations("Hero");
  const router = useRouter();
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showSlider, setShowSlider] = useState(false);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setShowSlider(true);
    }
  }, []);

  async function handleFileReady(file: File) {
    setIsUploading(true);
    setError(null);
    try {
      const upload = await createUpload(file);
      track("photo_uploaded", { source: "landing" });
      router.push(`/new?photoId=${upload.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("uploadFailed"));
      setIsUploading(false);
    }
  }

  return (
    <section
      id="top"
      className="relative overflow-hidden px-6 py-6 sm:px-8 sm:py-10 lg:h-[calc(100dvh-3.75rem)] lg:py-6"
    >
      <Parallax
        speed={0.12}
        max={70}
        className="pointer-events-none absolute -top-20 right-[8%] -z-10 h-72 w-72 rounded-full bg-accent/25 blur-3xl"
      >
        <div />
      </Parallax>
      <Parallax
        speed={-0.08}
        max={50}
        className="pointer-events-none absolute top-40 left-[6%] -z-10 h-56 w-56 rounded-full bg-muted-foreground/15 blur-3xl"
      >
        <div />
      </Parallax>

      <div className="mx-auto flex w-full max-w-2xl flex-col items-center gap-4 sm:gap-6 lg:h-full lg:max-w-5xl">
        <div className="relative aspect-video w-full overflow-hidden rounded-3xl shadow-xl shadow-black/10 lg:aspect-auto lg:min-h-0 lg:flex-1">
          <video
            className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-700 ${
              showSlider ? "pointer-events-none opacity-0" : "opacity-100"
            }`}
            width={830}
            height={1108}
            autoPlay
            muted
            playsInline
            preload="auto"
            poster="/hero-poster.jpg"
            aria-label={t("videoAlt")}
            onEnded={() => setShowSlider(true)}
          >
            <source src="/hero.webm" type="video/webm" />
            <source src="/hero.mp4" type="video/mp4" />
          </video>
          <BeforeAfterSlider
            beforeUrl="/room-before.jpg"
            afterUrl="/room-after.jpg"
            beforeAlt={t("beforeAfterAlt")}
            afterAlt={t("beforeAfterAlt")}
            className={`absolute inset-0 h-full w-full rounded-none! transition-opacity duration-700 ${
              showSlider ? "opacity-100" : "pointer-events-none opacity-0"
            }`}
          />
        </div>

        <div className="flex w-full flex-col items-center gap-4 text-center sm:gap-6 lg:shrink-0 lg:flex-row lg:items-center lg:justify-between lg:gap-12 lg:text-left">
          <div className="flex flex-col items-center gap-3 sm:gap-4 lg:items-start">
            <h1 className="font-display text-3xl leading-[1.1] tracking-tight text-balance sm:text-5xl lg:text-6xl">
              {t("title")}
            </h1>

            <p className="max-w-lg text-base text-muted-foreground text-balance sm:text-lg">
              {t("subtitle")}
            </p>
          </div>

          <div
            id="upload"
            className="w-full scroll-mt-24 rounded-3xl border border-white/40 bg-card/40 p-4 shadow-xl shadow-black/5 backdrop-blur-xl sm:p-6 lg:max-w-md lg:shrink-0"
          >
            <PhotoDropzone onFileReady={handleFileReady} disabled={isUploading} />
            {isUploading && (
              <p className="mt-3 text-center text-sm text-muted-foreground">
                {t("uploading")}
              </p>
            )}
            {error && (
              <p role="alert" className="mt-3 text-center text-sm text-red-600">
                {error}
              </p>
            )}
            <p className="mt-4 text-center text-sm text-muted-foreground">
              {t("freeNoCard")}
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
