"use client";

import { useEffect, useRef, useState } from "react";

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

interface VoiceTextareaProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  rows?: number;
}

export function VoiceTextarea({
  value,
  onChange,
  placeholder,
  rows = 3,
}: VoiceTextareaProps) {
  const [isListening, setIsListening] = useState(false);
  const [voiceSupported, setVoiceSupported] = useState(false);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const baseTranscriptRef = useRef("");

  useEffect(() => {
    // Browser feature detection can only run client-side, after mount.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setVoiceSupported(getSpeechRecognitionCtor() !== undefined);
  }, []);

  useEffect(() => {
    return () => recognitionRef.current?.stop();
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

    baseTranscriptRef.current = value;

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
      onChange(combined);
    };
    recognition.onend = () => setIsListening(false);
    recognition.onerror = () => setIsListening(false);

    recognitionRef.current = recognition;
    recognition.start();
    setIsListening(true);
  }

  return (
    <div className="relative">
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-xl border border-foreground/20 bg-transparent p-3 pr-11 text-sm"
        rows={rows}
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
  );
}
