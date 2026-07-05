type PlayerHandle = {
  id: string;
  pause: () => void;
};

let activePlayer: PlayerHandle | null = null;

/** Only one music preview plays at a time across the app. */
export function claimMusicPlayback(id: string, pause: () => void): void {
  if (activePlayer && activePlayer.id !== id) {
    activePlayer.pause();
  }
  activePlayer = { id, pause };
}

export function releaseMusicPlayback(id: string): void {
  if (activePlayer?.id === id) {
    activePlayer = null;
  }
}

export function formatMusicTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return "0:00";
  const whole = Math.floor(seconds);
  const mins = Math.floor(whole / 60);
  const secs = whole % 60;
  return `${mins}:${String(secs).padStart(2, "0")}`;
}
