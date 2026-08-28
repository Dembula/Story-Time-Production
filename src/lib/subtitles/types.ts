export type ContentSubtitleInput = {
  language: string;
  label: string;
  vttUrl: string;
  isDefault?: boolean;
};

export type PlaybackSubtitleTrack = {
  id: string;
  language: string;
  label: string;
  vttUrl: string;
  /** Same-origin proxy for private storage / CORS-safe fetch */
  proxyUrl: string;
  isDefault: boolean;
};
