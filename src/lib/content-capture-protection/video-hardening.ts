type MediaDevicesWithCapture = MediaDevices & {
  isScreenCaptured?: boolean;
  setCaptureHandleConfig?: (config: {
    handle?: string;
    permittedOrigins?: string[];
  }) => void;
  onisscreencapturedchange?: ((this: MediaDevices, ev: Event) => void) | null;
};

export function isScreenCaptureActive(): boolean {
  if (typeof navigator === "undefined") return false;
  const md = navigator.mediaDevices as MediaDevicesWithCapture | undefined;
  return md?.isScreenCaptured === true;
}

export function registerCaptureHandle(contentId: string): void {
  if (typeof navigator === "undefined") return;
  const md = navigator.mediaDevices as MediaDevicesWithCapture | undefined;
  md?.setCaptureHandleConfig?.({
    handle: `storytime-protected:${contentId}`,
    permittedOrigins: [window.location.origin],
  });
}

export function hardenVideoElement(video: HTMLVideoElement): void {
  video.disablePictureInPicture = false;
  video.disableRemotePlayback = true;
  video.setAttribute("controlsList", "nodownload noremoteplayback");
  video.setAttribute("playsinline", "true");
  video.setAttribute("webkit-playsinline", "true");
  video.crossOrigin = video.crossOrigin || "anonymous";

  const blockContextMenu = (event: Event) => {
    event.preventDefault();
  };
  video.addEventListener("contextmenu", blockContextMenu);

  const blockDrag = (event: Event) => {
    event.preventDefault();
  };
  video.addEventListener("dragstart", blockDrag);
}

export function subscribeScreenCaptureChanges(onChange: (captured: boolean) => void): () => void {
  if (typeof navigator === "undefined") return () => undefined;
  const md = navigator.mediaDevices as MediaDevicesWithCapture | undefined;
  if (!md) return () => undefined;

  const handler = () => onChange(isScreenCaptureActive());
  md.onisscreencapturedchange = handler;

  const interval = window.setInterval(() => {
    onChange(isScreenCaptureActive());
  }, 1500);

  return () => {
    if (md.onisscreencapturedchange === handler) {
      md.onisscreencapturedchange = null;
    }
    window.clearInterval(interval);
  };
}
