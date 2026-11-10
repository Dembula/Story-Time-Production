"use client";

import { useCallback, useRef, useState } from "react";

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
    if (screenVideo) tracks.push(screenVideo);
    else if (camVideo) tracks.push(camVideo);
    if (audio) tracks.push(audio);
    if (!tracks.length) throw new Error("Nothing to record — enable mic or camera first");

    const stream = new MediaStream(tracks.map((t) => t.clone()));
    streamRef.current = stream;
    chunksRef.current = [];
    const mime = MediaRecorder.isTypeSupported("video/webm;codecs=vp9,opus")
      ? "video/webm;codecs=vp9,opus"
      : MediaRecorder.isTypeSupported("video/webm")
        ? "video/webm"
        : "audio/webm";
    const recorder = new MediaRecorder(stream, { mimeType: mime });
    recorder.ondataavailable = (ev) => {
      if (ev.data.size > 0) chunksRef.current.push(ev.data);
    };
    recorderRef.current = recorder;
    recorder.start(2000);
    setRecording(true);
  }, []);

  const stop = useCallback(async (): Promise<Blob | null> => {
    const recorder = recorderRef.current;
    if (!recorder) return null;
    const blob = await new Promise<Blob | null>((resolve) => {
      recorder.onstop = () => {
        const type = recorder.mimeType || "video/webm";
        resolve(chunksRef.current.length ? new Blob(chunksRef.current, { type }) : null);
      };
      try {
        recorder.stop();
      } catch {
        resolve(null);
      }
    });
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    recorderRef.current = null;
    chunksRef.current = [];
    setRecording(false);
    return blob;
  }, []);

  return { recording, start, stop };
}
