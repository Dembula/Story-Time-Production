"use client";

import { useEffect, useRef } from "react";

type SpeechRecognitionResultLike = {
  isFinal?: boolean;
  0?: { transcript?: string; confidence?: number };
};

type SpeechRecognitionEventLike = {
  resultIndex: number;
  results: ArrayLike<SpeechRecognitionResultLike> & { length: number };
};

type SpeechRecognitionLike = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  maxAlternatives?: number;
  onresult: ((ev: SpeechRecognitionEventLike) => void) | null;
  onerror: ((ev: { error?: string }) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
  abort?: () => void;
};

/**
 * Attentive browser speech recognition for Meet VA notes.
 * - Merges rapid finals into coherent utterances (not random one-liners)
 * - Restarts after browser timeouts so listening stays on while unmuted
 */
export function useMeetSpeech(options: {
  enabled: boolean;
  muted: boolean;
  /** Called with a cleaned, merged utterance ready to attribute to a speaker. */
  onFinal: (text: string) => void;
  /** Optional live partial text for UI “listening…” feedback. */
  onInterim?: (text: string) => void;
}) {
  const onFinalRef = useRef(options.onFinal);
  onFinalRef.current = options.onFinal;
  const onInterimRef = useRef(options.onInterim);
  onInterimRef.current = options.onInterim;
  const recRef = useRef<SpeechRecognitionLike | null>(null);
  const wantRef = useRef(false);
  const bufferRef = useRef("");
  const flushTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastEmitRef = useRef("");

  useEffect(() => {
    wantRef.current = options.enabled && !options.muted;

    const flush = (force = false) => {
      if (flushTimerRef.current) {
        clearTimeout(flushTimerRef.current);
        flushTimerRef.current = null;
      }
      const raw = bufferRef.current.replace(/\s+/g, " ").trim();
      bufferRef.current = "";
      if (!raw) return;
      // Drop tiny noise fragments unless forced (end of session).
      if (!force && raw.split(/\s+/).length < 2 && raw.length < 12) return;
      // Dedupe exact repeats from recognition restarts.
      if (raw === lastEmitRef.current) return;
      lastEmitRef.current = raw;
      onFinalRef.current(raw);
      onInterimRef.current?.("");
    };

    const scheduleFlush = () => {
      if (flushTimerRef.current) clearTimeout(flushTimerRef.current);
      // Hold briefly so consecutive finals become one spoken thought.
      flushTimerRef.current = setTimeout(() => flush(false), 1600);
    };

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
      flush(true);
      try {
        recRef.current?.stop();
      } catch {
        /* ignore */
      }
      recRef.current = null;
      onInterimRef.current?.("");
      return;
    }

    const rec = new SpeechRecognitionCtor();
    rec.continuous = true;
    rec.interimResults = true;
    rec.maxAlternatives = 1;
    rec.lang = typeof navigator !== "undefined" ? navigator.language || "en-US" : "en-US";

    rec.onresult = (ev) => {
      let interim = "";
      for (let i = ev.resultIndex; i < ev.results.length; i++) {
        const result = ev.results[i];
        const piece = result?.[0]?.transcript?.trim();
        if (!piece) continue;
        if (result.isFinal === false) {
          interim = interim ? `${interim} ${piece}` : piece;
          continue;
        }
        bufferRef.current = bufferRef.current ? `${bufferRef.current} ${piece}` : piece;
        scheduleFlush();
      }
      if (interim) onInterimRef.current?.(interim);
    };

    rec.onerror = (ev) => {
      // no-speech / aborted are normal; keep listening via onend restart.
      if (ev.error === "not-allowed" || ev.error === "service-not-allowed") {
        wantRef.current = false;
      }
    };

    rec.onend = () => {
      // Flush any pending buffer when the engine pauses.
      if (bufferRef.current) flush(false);
      if (!wantRef.current) return;
      window.setTimeout(() => {
        if (!wantRef.current || recRef.current !== rec) return;
        try {
          rec.start();
        } catch {
          /* ignore */
        }
      }, 180);
    };

    recRef.current = rec;
    try {
      rec.start();
    } catch {
      /* ignore */
    }

    return () => {
      wantRef.current = false;
      flush(true);
      try {
        rec.stop();
      } catch {
        /* ignore */
      }
      recRef.current = null;
    };
  }, [options.enabled, options.muted]);
}
