/** Platform policies and docs indexed for grounded MODOC answers. */
export const PLATFORM_POLICY_CHUNKS = [
  {
    chunkKey: "platform_policy:viewer_subscription",
    title: "Viewer subscription model",
    chunkText:
      "Story Time viewers subscribe to access the catalogue. Free trials allow catalogue browsing but trial watch time does not count toward creator revenue until the first successful payment. Subscriptions renew automatically unless cancelled.",
  },
  {
    chunkKey: "platform_policy:creator_revenue",
    title: "Creator revenue share",
    chunkText:
      "Creator revenue comes from a viewer pool funded by succeeded subscription and PPV payments. Sixty percent of net viewer pool revenue is split among creators proportionally by eligible watch time (paid views only, not free trial). Platform retains forty percent.",
  },
  {
    chunkKey: "platform_policy:content_safety",
    title: "Content safety and age ratings",
    chunkText:
      "All catalogue content has age ratings and advisory metadata. Viewer profiles enforce minAge filters. MODOC must respect age-appropriate recommendations and never suggest content above a profile's age limit.",
  },
  {
    chunkKey: "platform_policy:modoc_actions",
    title: "MODOC action protocol",
    chunkText:
      "MODOC executes real creator dashboard actions via MODOC_ACTION JSON blocks. Prefer structured actions over vague advice. Never invent database ids. Use MODOC_SUGGEST when uncertain or when an action is destructive without confirmation.",
  },
  {
    chunkKey: "platform_policy:playback_priority",
    title: "Playback performance priority",
    chunkText:
      "Video streaming, HLS playback, seek, resume, subtitles, and offline playback always take priority over AI features. AI companion and retrieval run asynchronously and must never block the player.",
  },
] as const;
