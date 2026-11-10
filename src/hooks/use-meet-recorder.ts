"use client";

import { useCallback, useRef, useState } from "react";

function pickMimeType() {
  const candidates = [
    "video/webm;codecs=vp9,opus",
    "video/webm;codecs=vp8,opus",
    "video/webm",
    "video/mp4",
    "audio/webm",
  ];
  for (const type of candidates) {
    if (typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported(type)) {
      return type;
    }
  }
  return "";
}

/** Records mic (+ optional screen/camera video) for Meet archival. */
export function useMeetRecorder() {
  const [recording, setRecording] = useState(false);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);

  const start = useCallback(async (input: {
    localStream: MediaStream | null;
    screenStream?: MediaStream | null;
  }) => {
    if (recorderRef.current) return;
    const tracks: MediaStreamTrack[] = [];
    const screenVideo = input.screenStream?.getVideoTracks()[0];
    const camVideo = input.localStream?.getVideoTracks()[0];
    const audio = input.localStream?.getAudioTracks()[0];
    if (screenVideo && screenVideo.readyState === "live") tracks.push(screenVideo);
    else if (camVideo && camVideo.readyState === "live") tracks.push(camVideo);
    if (audio && audio.readyState === "live") tracks.push(audio);
    if (!tracks.length) throw new Error("Nothing to record — enable mic or camera first");

    // Prefer live tracks directly so we don't freeze a dead clone.
    const stream = new MediaStream(tracks);
    streamRef.current = stream;
    chunksRef.current = [];
    const mime = pickMimeType();
    const recorder = mime
      ? new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 1_500_000 })
      : new MediaRecorder(stream);
    recorder.ondataavailable = (ev) => {
      if (ev.data && ev.data.size > 0) chunksRef.current.push(ev.data);
    };
    recorder.onerror = () => {
      /* keep chunks collected so far */
    };
    recorderRef.current = recorder;
    recorder.start(1000);
    setRecording(true);
  }, []);

  const stop = useCallback(async (): Promise<Blob | null> => {
    const recorder = recorderRef.current;
    if (!recorder) return null;

    const blob = await new Promise<Blob | null>((resolve) => {
      const finish = () => {
        const type = recorder.mimeType || pickMimeType() || "video/webm";
        resolve(chunksRef.current.length ? new Blob(chunksRef.current, { type }) : null);
      };
      recorder.onstop = finish;
      try {
        if (recorder.state === "recording") {
          try {
            recorder.requestData();
          } catch {
            /* ignore */
          }
          setTimeout(() => {
            try {
              recorder.stop();
            } catch {
              finish();
            }
          }, 120);
        } else {
          finish();
        }
      } catch {
        finish();
      }
    });

    // Don't stop source camera/screen tracks — only clear recorder refs.
    streamRef.current = null;
    recorderRef.current = null;
    chunksRef.current = [];
    setRecording(false);
    return blob;
  }, []);

  return { recording, start, stop };
}
