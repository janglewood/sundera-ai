"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useRef, useState } from "react";
import type { DesignStyle, RoomType } from "@sundera/shared";
import { RoomTypeGrid } from "@/components/select/RoomTypeGrid";
import { StyleGrid } from "@/components/select/StyleGrid";
import { createGeneration } from "@/lib/generations";

interface SpeechRecognitionResultLike {
  isFinal: boolean;
  [index: number]: { transcript: string };
}

interface SpeechRecognitionEventLike {
  resultIndex: number;
  results: ArrayLike<SpeechRecognitionResultLike>;
}

interface SpeechRecognitionLike extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start(): void;
  stop(): void;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onend: (() => void) | null;
  onerror: (() => void) | null;
}

function getSpeechRecognitionCtor(): (new () => SpeechRecognitionLike) | undefined {
  if (typeof window === "undefined") return undefined;
  const w = window as unknown as {
    SpeechRecognition?: new () => SpeechRecognitionLike;
    webkitSpeechRecognition?: new () => SpeechRecognitionLike;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition;
}

function NewGenerationForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const photoId = searchParams.get("photoId");

  const [roomType, setRoomType] = useState<RoomType | null>(null);
  const [style, setStyle] = useState<DesignStyle | null>(null);
  const [customPrompt, setCustomPrompt] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isListening, setIsListening] = useState(false);
  const [voiceSupported, setVoiceSupported] = useState(false);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const baseTranscriptRef = useRef("");

  useEffect(() => {
    // Browser feature detection can only run client-side, after mount.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setVoiceSupported(getSpeechRecognitionCtor() !== undefined);
  }, []);

  function toggleListening() {
    if (isListening) {
      recognitionRef.current?.stop();
      return;
    }

    const SpeechRecognitionCtor = getSpeechRecognitionCtor();
    if (!SpeechRecognitionCtor) return;

    const recognition = new SpeechRecognitionCtor();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = "en-US";

    baseTranscriptRef.current = customPrompt;

    recognition.onresult = (event) => {
      let finalTranscript = "";
      let interimTranscript = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        if (result.isFinal) {
          finalTranscript += result[0].transcript;
        } else {
          interimTranscript += result[0].transcript;
        }
      }
      if (finalTranscript) {
        baseTranscriptRef.current = [baseTranscriptRef.current, finalTranscript]
          .filter(Boolean)
          .join(" ");
      }
      const combined = [baseTranscriptRef.current, interimTranscript]
        .filter(Boolean)
        .join(" ");
      setCustomPrompt(combined);
    };
    recognition.onend = () => setIsListening(false);
    recognition.onerror = () => setIsListening(false);

    recognitionRef.current = recognition;
    recognition.start();
    setIsListening(true);
  }

  useEffect(() => {
    return () => recognitionRef.current?.stop();
  }, []);

  if (!photoId) {
    return (
      <div className="text-center text-foreground/60">
        Missing photo. Please{" "}
        <Link href="/" className="underline">
          upload a room photo
        </Link>{" "}
        first.
      </div>
    );
  }

  async function handleSubmit() {
    if (!photoId || !roomType || !style) return;
    setIsSubmitting(true);
    setError(null);
    try {
      const generation = await createGeneration({
        roomPhotoId: photoId,
        roomType,
        style,
        customPrompt: customPrompt.trim() || undefined,
      });
      router.push(`/generations/${generation.id}`);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to start generation",
      );
      setIsSubmitting(false);
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-10 px-6 py-16">
      <section>
        <h2 className="mb-4 text-lg font-semibold">What room is this?</h2>
        <RoomTypeGrid value={roomType} onChange={setRoomType} />
      </section>

      <section>
        <h2 className="mb-4 text-lg font-semibold">Pick a style</h2>
        <StyleGrid value={style} onChange={setStyle} />
      </section>

      <section>
        <label className="mb-2 block text-sm font-medium">
          Anything else? (optional)
        </label>
        <div className="relative">
          <textarea
            value={customPrompt}
            onChange={(e) => setCustomPrompt(e.target.value)}
            placeholder="e.g. add more plants, keep the wooden floor"
            className="w-full rounded-xl border border-foreground/20 bg-transparent p-3 pr-11 text-sm"
            rows={3}
          />
          {voiceSupported && (
            <button
              type="button"
              onClick={toggleListening}
              aria-pressed={isListening}
              aria-label={isListening ? "Stop voice input" : "Start voice input"}
              title={isListening ? "Stop voice input" : "Start voice input"}
              className={`absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-full transition-colors ${
                isListening
                  ? "bg-red-500 text-white animate-pulse"
                  : "bg-foreground/10 text-foreground/70 hover:bg-foreground/20"
              }`}
            >
              <svg
                viewBox="0 0 24 24"
                fill="currentColor"
                className="h-4 w-4"
                aria-hidden="true"
              >
                <path d="M12 15a3 3 0 0 0 3-3V6a3 3 0 0 0-6 0v6a3 3 0 0 0 3 3Z" />
                <path d="M19 11a1 1 0 1 0-2 0 5 5 0 0 1-10 0 1 1 0 1 0-2 0 7 7 0 0 0 6 6.93V20H9a1 1 0 1 0 0 2h6a1 1 0 1 0 0-2h-2v-2.07A7 7 0 0 0 19 11Z" />
              </svg>
            </button>
          )}
        </div>
      </section>

      {error && <p className="text-sm text-red-500">{error}</p>}

      <button
        type="button"
        disabled={!roomType || !style || isSubmitting}
        onClick={() => void handleSubmit()}
        className="rounded-full bg-foreground px-6 py-3 font-medium text-background transition-opacity disabled:opacity-40"
      >
        {isSubmitting ? "Starting…" : "Generate redesign"}
      </button>
    </div>
  );
}

export default function NewGenerationPage() {
  return (
    <Suspense>
      <NewGenerationForm />
    </Suspense>
  );
}
