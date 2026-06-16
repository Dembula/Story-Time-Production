/**
 * Apple FairPlay Streaming (FPS) for native HLS playback (Safari / iOS / tvOS).
 *
 * Vidstack/hls.js handle Widevine + PlayReady through the EME config in
 * `hls-drm.ts`, but Safari plays HLS natively and never instantiates hls.js — so
 * FairPlay must be wired directly onto the `<video>` element via the W3C EME API.
 * This module does exactly that and is the piece required for Apple-platform DRM
 * approval. It is a no-op unless the stream is actually encrypted and a FairPlay
 * certificate + license endpoint are configured.
 */

const FAIRPLAY_KEY_SYSTEMS = ["com.apple.fps", "com.apple.fps.1_0", "com.apple.fps.2_0"];

export type FairPlayOptions = {
  /** URL returning the FairPlay application certificate (DER bytes). */
  certificateUrl: string;
  /** URL accepting the SPC and returning the CKC (license). */
  licenseUrl: string;
  /** Optional bearer token forwarded to the license request. */
  authToken?: string | null;
  onError?: (error: unknown) => void;
};

export function isFairPlaySupported(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof window.MediaKeys !== "undefined" &&
    typeof navigator !== "undefined" &&
    typeof navigator.requestMediaKeySystemAccess === "function"
  );
}

async function fetchBinary(url: string, init?: RequestInit): Promise<ArrayBuffer> {
  const res = await fetch(url, { cache: "no-store", ...init });
  if (!res.ok) {
    throw new Error(`FairPlay request failed (${res.status}) for ${url}`);
  }
  return res.arrayBuffer();
}

async function negotiateKeySystemAccess(): Promise<MediaKeySystemAccess | null> {
  const config: MediaKeySystemConfiguration[] = [
    {
      initDataTypes: ["sinf", "skd", "cenc"],
      videoCapabilities: [{ contentType: 'video/mp4; codecs="avc1.42E01E"' }],
      audioCapabilities: [{ contentType: 'audio/mp4; codecs="mp4a.40.2"' }],
      distinctiveIdentifier: "not-allowed",
      persistentState: "not-allowed",
      sessionTypes: ["temporary"],
    },
  ];

  for (const keySystem of FAIRPLAY_KEY_SYSTEMS) {
    try {
      return await navigator.requestMediaKeySystemAccess(keySystem, config);
    } catch {
      // Try the next key-system identifier.
    }
  }
  return null;
}

/**
 * Attach FairPlay to a native `<video>` element.
 * Returns a cleanup function that removes listeners.
 */
export function attachFairPlay(video: HTMLVideoElement, options: FairPlayOptions): () => void {
  if (!isFairPlaySupported()) return () => {};

  let cancelled = false;
  let mediaKeys: MediaKeys | null = null;
  let initPromise: Promise<MediaKeys | null> | null = null;

  const handleError = (error: unknown) => {
    if (!cancelled) options.onError?.(error);
  };

  const ensureMediaKeys = async (): Promise<MediaKeys | null> => {
    if (mediaKeys) return mediaKeys;
    if (initPromise) return initPromise;

    initPromise = (async () => {
      const access = await negotiateKeySystemAccess();
      if (!access || cancelled) return null;

      const keys = await access.createMediaKeys();
      const certificate = await fetchBinary(options.certificateUrl);
      if (cancelled) return null;

      try {
        await keys.setServerCertificate(certificate);
      } catch (err) {
        // Some FairPlay deployments embed the certificate per-session instead.
        handleError(err);
      }

      await video.setMediaKeys(keys);
      mediaKeys = keys;
      return keys;
    })().catch((err) => {
      handleError(err);
      return null;
    });

    return initPromise;
  };

  const requestLicense = async (session: MediaKeySession, message: ArrayBuffer) => {
    const headers: Record<string, string> = { "Content-Type": "application/octet-stream" };
    if (options.authToken) headers.Authorization = `Bearer ${options.authToken}`;
    const ckc = await fetchBinary(options.licenseUrl, {
      method: "POST",
      headers,
      body: message,
    });
    if (cancelled) return;
    await session.update(new Uint8Array(ckc));
  };

  const onEncrypted = async (event: MediaEncryptedEvent) => {
    try {
      const keys = await ensureMediaKeys();
      if (!keys || cancelled || !event.initData) return;

      const session = keys.createSession("temporary");
      session.addEventListener("message", (msgEvent) => {
        const message = (msgEvent as MediaKeyMessageEvent).message;
        void requestLicense(session, message).catch(handleError);
      });
      await session.generateRequest(event.initDataType, event.initData);
    } catch (err) {
      handleError(err);
    }
  };

  const listener = (event: Event) => {
    void onEncrypted(event as MediaEncryptedEvent);
  };

  video.addEventListener("encrypted", listener);
  // Warm the key-system + certificate so the first encrypted frame plays instantly.
  void ensureMediaKeys();

  return () => {
    cancelled = true;
    video.removeEventListener("encrypted", listener);
  };
}
