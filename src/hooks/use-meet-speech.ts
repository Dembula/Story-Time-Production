"use client";

import { useEffect, useRef } from "react";

type SpeechRecognitionLike = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((ev: { results: ArrayLike<ArrayLike<{ transcript: string }>> & { length: number } }) => void) | null;
  onerror: ((ev: { error?: string }) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
};

/**
 * Browser speech recognition → VA notes. Uses Web Speech API when available.
 */
export function useMeetSpeech(options: {
  enabled: boolean;
  muted: boolean;
  onFinal: (text: string) => void;
}) {
  const onFinalRef = useRef(options.onFinal);
  onFinalRef.current = options.onFinal;
  const recRef = useRef<SpeechRecognitionLike | null>(null);
  const wantRef = useRef(false);

  useEffect(() => {
    wantRef.current = options.enabled && !options.muted;
    const SpeechRecognitionCtor =
      typeof window !== "undefined"
        ? ((window as unknown as {
            SpeechRecognition?: new () => SpeechRecognitionLike;
            webkitSpeechRecognition?: new () => SpeechRecognitionLike;
          }).SpeechRecognition ??
          (window as unknown as { webkitSpeechRecognition?: new () => SpeechRecognitionLike })
            .webkitSpeechRecognition)
        : undefined;

    if (!SpeechRecognitionCtor) return;

    if (!wantRef.current) {
      try {
        recRef.current?.stop();
      } catch {
        /* ignore */
      }
      recRef.current = null;
      return;
    }

    const rec = new SpeechRecognitionCtor();
    rec.continuous = true;
    rec.interimResults = false;
    rec.lang = typeof navigator !== "undefined" ? navigator.language || "en-US" : "en-US";
    rec.onresult = (ev) => {
      const last = ev.results[ev.results.length - 1];
      const text = last?.[0]?.transcript?.trim();
      if (text) onFinalRef.current(text);
    };
    rec.onerror = () => {
      /* permission / no-speech — keep trying via onend restart */
    };
    rec.onend = () => {
      if (!wantRef.current) return;
      try {
        rec.start();
      } catch {
        /* ignore */
      }
    };
    recRef.current = rec;
    try {
      rec.start();
    } catch {
      /* ignore */
    }

    return () => {
      wantRef.current = false;
      try {
        rec.stop();
      } catch {
        /* ignore */
      }
      recRef.current = null;
    };
  }, [options.enabled, options.muted]);
}
