/** Shared imperative API for Vidstack and direct hls.js desktop playback. */
export type StorytimePlaybackHandle = {
  play(): Promise<void>;
  pause(): void;
  readonly currentTime: number;
  readonly duration: number;
  setCurrentTime(time: number): void;
  readonly paused: boolean;
  getVideoElement(): HTMLVideoElement | null;
};

export function createVidstackPlaybackHandle(
  player: {
    play(): Promise<void>;
    pause(): void;
    currentTime: number;
    duration: number;
    paused: boolean;
    el?: HTMLElement | null;
  } | null,
): StorytimePlaybackHandle | null {
  if (!player) return null;
  return {
    play: () => player.play(),
    pause: () => player.pause(),
    get currentTime() {
      return player.currentTime;
    },
    get duration() {
      return player.duration;
    },
    setCurrentTime(time: number) {
      player.currentTime = time;
    },
    get paused() {
      return player.paused;
    },
    getVideoElement() {
      return (player.el?.querySelector("video") as HTMLVideoElement | null) ?? null;
    },
  };
}
