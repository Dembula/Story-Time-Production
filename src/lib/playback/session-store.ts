import { create } from "zustand";

export type MiniPlayerState = {
  contentId: string;
  title: string;
  videoUrl: string;
  posterUrl: string | null;
  positionSeconds: number;
} | null;

type PlaybackSessionState = {
  miniPlayer: MiniPlayerState;
  ambientUiVisible: boolean;
  setMiniPlayer: (state: MiniPlayerState) => void;
  clearMiniPlayer: () => void;
  setAmbientUiVisible: (visible: boolean) => void;
};

export const usePlaybackSession = create<PlaybackSessionState>((set) => ({
  miniPlayer: null,
  ambientUiVisible: true,
  setMiniPlayer: (miniPlayer) => set({ miniPlayer }),
  clearMiniPlayer: () => set({ miniPlayer: null }),
  setAmbientUiVisible: (ambientUiVisible) => set({ ambientUiVisible }),
}));
