import { FAIRPLAY_LEGACY_KEY_SYSTEM, type PlaybackDrmDescriptor } from "./drm-systems";

const MODERN_FAIRPLAY_KEY_SYSTEM = "com.apple.fps";

type FairplaySetup = {
  licenseUrl: string;
  certificateUrl: string;
  /** Optional bearer token for first-party proxy (usually unnecessary). */
  authToken?: string | null;
  onError?: (error: unknown) => void;
};

function toBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.byteLength; i += 1) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}

function base64ToBytes(value: string): Uint8Array {
  const binary = atob(value.trim());
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

async function fetchCertificate(url: string, authToken?: string | null): Promise<ArrayBuffer> {
  const res = await fetch(url, {
    headers: authToken ? { Authorization: `Bearer ${authToken}` } : undefined,
    cache: "force-cache",
  });
  if (!res.ok) throw new Error(`FairPlay certificate request failed (${res.status})`);
  const contentType = res.headers.get("content-type") ?? "";
  if (contentType.includes("text") || contentType.includes("base64")) {
    return base64ToBytes(await res.text()).buffer as ArrayBuffer;
  }
  return res.arrayBuffer();
}

function extractContentId(initData: ArrayBuffer): string | null {
  try {
    // FairPlay skd init data is a UTF-16 `skd://<asset-id>` URL.
    const text = new TextDecoder("utf-16le").decode(initData);
    const match = text.match(/skd:\/\/([^"']+)/i);
    if (match?.[1]) return match[1];
    const ascii = new TextDecoder().decode(initData);
    const asciiMatch = ascii.match(/skd:\/\/([^"']+)/i);
    return asciiMatch?.[1] ?? null;
  } catch {
    return null;
  }
}

async function requestLicense(
  setup: FairplaySetup,
  spc: ArrayBuffer,
  contentId: string | null,
): Promise<ArrayBuffer> {
  const headers: Record<string, string> = { "Content-Type": "application/octet-stream" };
  if (setup.authToken) headers.Authorization = `Bearer ${setup.authToken}`;
  if (contentId) headers["X-Fairplay-Content-Id"] = contentId;

  const res = await fetch(setup.licenseUrl, {
    method: "POST",
    headers,
    body: spc,
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`FairPlay license request failed (${res.status})`);

  const contentType = res.headers.get("content-type") ?? "";
  if (contentType.includes("json")) {
    const json = (await res.json()) as { ckc?: string; license?: string };
    const payload = json.ckc ?? json.license;
    if (!payload) throw new Error("FairPlay license response missing CKC");
    return base64ToBytes(payload).buffer as ArrayBuffer;
  }
  if (contentType.includes("text") || contentType.includes("base64")) {
    return base64ToBytes(await res.text()).buffer as ArrayBuffer;
  }
  return res.arrayBuffer();
}

/**
 * Wire native Apple FairPlay Streaming on a `<video>` element using the standard
 * Encrypted Media Extensions API. Safari / iOS / iPadOS / visionOS play HLS
 * natively (hls.js is bypassed), so this is the ONLY path that protects content
 * on Apple platforms — and the path Apple verifies when approving a service.
 *
 * Returns a cleanup function. No-ops gracefully when EME / FairPlay is
 * unavailable so unprotected playback is never blocked.
 */
export function attachNativeFairplay(video: HTMLVideoElement, setup: FairplaySetup): () => void {
  if (typeof window === "undefined") return () => undefined;

  let disposed = false;
  let certificate: ArrayBuffer | null = null;
  const cleanups: Array<() => void> = [];

  const fail = (error: unknown) => {
    if (!disposed) setup.onError?.(error);
  };

  const ensureCertificate = async (): Promise<ArrayBuffer> => {
    if (certificate) return certificate;
    certificate = await fetchCertificate(setup.certificateUrl, setup.authToken);
    return certificate;
  };

  const supportsModernEme =
    typeof navigator.requestMediaKeySystemAccess === "function" &&
    typeof video.setMediaKeys === "function";

  if (supportsModernEme) {
    let mediaKeysReady: Promise<MediaKeys> | null = null;

    const initMediaKeys = async (): Promise<MediaKeys> => {
      if (mediaKeysReady) return mediaKeysReady;
      mediaKeysReady = (async () => {
        const config: MediaKeySystemConfiguration[] = [
          {
            initDataTypes: ["sinf", "skd"],
            videoCapabilities: [{ contentType: 'video/mp4; codecs="avc1.42E01E"' }],
            audioCapabilities: [{ contentType: 'audio/mp4; codecs="mp4a.40.2"' }],
            distinctiveIdentifier: "not-allowed",
            persistentState: "not-allowed",
          },
        ];
        const access = await navigator.requestMediaKeySystemAccess(MODERN_FAIRPLAY_KEY_SYSTEM, config);
        const mediaKeys = await access.createMediaKeys();
        const cert = await ensureCertificate();
        if (typeof mediaKeys.setServerCertificate === "function") {
          await mediaKeys.setServerCertificate(cert);
        }
        await video.setMediaKeys(mediaKeys);
        return mediaKeys;
      })();
      return mediaKeysReady;
    };

    const onEncrypted = async (event: MediaEncryptedEvent): Promise<void> => {
      try {
        if (!event.initData) return;
        const mediaKeys = await initMediaKeys();
        const session = mediaKeys.createSession();
        const contentId = extractContentId(event.initData);

        const onMessage = async (msgEvent: MediaKeyMessageEvent): Promise<void> => {
          try {
            const ckc = await requestLicense(setup, msgEvent.message, contentId);
            await session.update(ckc);
          } catch (error) {
            fail(error);
          }
        };
        session.addEventListener("message", onMessage);
        cleanups.push(() => session.removeEventListener("message", onMessage));

        await session.generateRequest(event.initDataType, event.initData);
      } catch (error) {
        fail(error);
      }
    };

    video.addEventListener("encrypted", onEncrypted);
    cleanups.push(() => video.removeEventListener("encrypted", onEncrypted));
    // Prime MediaKeys + certificate early so the first encrypted frame is instant.
    void initMediaKeys().catch(fail);

    return () => {
      disposed = true;
      cleanups.forEach((fn) => fn());
    };
  }

  // Legacy WebKit FairPlay path (older Safari without standard EME `encrypted`).
  const legacy = attachLegacyWebkitFairplay(video, setup, ensureCertificate, fail);
  if (legacy) cleanups.push(legacy);

  return () => {
    disposed = true;
    cleanups.forEach((fn) => fn());
  };
}

type WebkitVideoElement = HTMLVideoElement & {
  webkitSetMediaKeys?: (keys: unknown) => void;
  webkitKeys?: unknown;
};

function attachLegacyWebkitFairplay(
  video: HTMLVideoElement,
  setup: FairplaySetup,
  ensureCertificate: () => Promise<ArrayBuffer>,
  fail: (error: unknown) => void,
): (() => void) | null {
  const win = window as unknown as {
    WebKitMediaKeys?: {
      isTypeSupported: (keySystem: string, type: string) => boolean;
      new (keySystem: string): {
        createSession: (type: string, initData: Uint8Array) => WebkitKeySession;
      };
    };
  };
  const WebKitMediaKeys = win.WebKitMediaKeys;
  const webkitVideo = video as WebkitVideoElement;
  if (!WebKitMediaKeys || typeof webkitVideo.webkitSetMediaKeys !== "function") return null;
  if (!WebKitMediaKeys.isTypeSupported(FAIRPLAY_LEGACY_KEY_SYSTEM, "video/mp4")) return null;

  const onNeedKey = async (event: Event) => {
    try {
      const initData = (event as unknown as { initData?: Uint8Array }).initData;
      if (!initData) return;
      await ensureCertificate();
      if (!webkitVideo.webkitKeys) {
        webkitVideo.webkitSetMediaKeys?.(new WebKitMediaKeys(FAIRPLAY_LEGACY_KEY_SYSTEM));
      }
      const keys = webkitVideo.webkitKeys as { createSession: (type: string, data: Uint8Array) => WebkitKeySession };
      const session = keys.createSession("video/mp4", initData);
      const contentId = extractContentId(initData.buffer as ArrayBuffer);

      const onKeyMessage = async (msgEvent: Event) => {
        try {
          const message = (msgEvent as unknown as { message?: ArrayBuffer }).message;
          if (!message) return;
          const ckc = await requestLicense(setup, message, contentId);
          session.update(new Uint8Array(ckc));
        } catch (error) {
          fail(error);
        }
      };
      session.addEventListener("webkitkeymessage", onKeyMessage as EventListener);
    } catch (error) {
      fail(error);
    }
  };

  video.addEventListener("webkitneedkey", onNeedKey as EventListener);
  return () => video.removeEventListener("webkitneedkey", onNeedKey as EventListener);
}

type WebkitKeySession = {
  addEventListener: (type: string, listener: EventListener) => void;
  update: (data: Uint8Array) => void;
};

/** Build a native FairPlay setup from a playback DRM descriptor, when usable. */
export function fairplaySetupFromDescriptor(
  descriptor: PlaybackDrmDescriptor | null | undefined,
): { licenseUrl: string; certificateUrl: string } | null {
  if (
    !descriptor?.enabled ||
    !descriptor.systems.includes("fairplay") ||
    !descriptor.fairplayLicenseUrl ||
    !descriptor.fairplayCertificateUrl
  ) {
    return null;
  }
  return {
    licenseUrl: descriptor.fairplayLicenseUrl,
    certificateUrl: descriptor.fairplayCertificateUrl,
  };
}
