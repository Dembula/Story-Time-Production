/**
 * Browser-only probe: duration (and thus estimated bitrate) without uploading.
 */
export type VideoFileProbe = {
  durationSeconds: number;
  width: number | null;
  height: number | null;
  estimatedBitrateMbps: number | null;
};

export async function probeVideoFile(file: File): Promise<VideoFileProbe | null> {
  if (!file.type.startsWith("video/") && !/\.(mp4|mov|m4v|webm|mkv|avi)$/i.test(file.name)) {
    return null;
  }

  const objectUrl = URL.createObjectURL(file);
  try {
    const durationSeconds = await new Promise<number>((resolve, reject) => {
      const video = document.createElement("video");
      video.preload = "metadata";
      video.muted = true;
      video.playsInline = true;
      const timer = window.setTimeout(() => {
        cleanup();
        reject(new Error("Video metadata timed out"));
      }, 20_000);
      const cleanup = () => {
        window.clearTimeout(timer);
        video.removeAttribute("src");
        video.load();
        video.onloadedmetadata = null;
        video.onerror = null;
      };
      video.onloadedmetadata = () => {
        const d = video.duration;
        cleanup();
        if (!Number.isFinite(d) || d <= 0) {
          reject(new Error("Could not read video duration"));
          return;
        }
        resolve(d);
      };
      video.onerror = () => {
        cleanup();
        reject(new Error("Could not read video metadata"));
      };
      video.src = objectUrl;
    });

    const video = document.createElement("video");
    video.preload = "metadata";
    video.src = objectUrl;
    await new Promise<void>((resolve) => {
      if (video.readyState >= 1) {
        resolve();
        return;
      }
      video.onloadedmetadata = () => resolve();
      video.onerror = () => resolve();
    });

    const estimatedBitrateMbps =
      durationSeconds > 0.5 ? (file.size * 8) / durationSeconds / 1_000_000 : null;

    return {
      durationSeconds,
      width: video.videoWidth || null,
      height: video.videoHeight || null,
      estimatedBitrateMbps,
    };
  } catch {
    return null;
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}
