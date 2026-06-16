type HlsConfig = Record<string, unknown>;

/**
 * hls.js tuning for near-instant VOD start (Netflix-style fast time-to-first-frame).
 * Applied on top of DRM config when present.
 */
export function buildHlsInstantStartConfig(): HlsConfig {
  return {
    enableWorker: true,
    lowLatencyMode: false,
    startLevel: -1,
    autoStartLoad: true,
    startFragPrefetch: true,
    testBandwidth: true,
    progressive: false,
    maxBufferLength: 30,
    maxMaxBufferLength: 60,
    backBufferLength: 30,
    maxBufferSize: 60 * 1000 * 1000,
    maxBufferHole: 0.5,
    nudgeMaxRetry: 5,
    manifestLoadingTimeOut: 10000,
    manifestLoadingMaxRetry: 4,
    levelLoadingTimeOut: 10000,
    fragLoadingTimeOut: 20000,
    fragLoadingMaxRetry: 6,
  };
}

export function mergeHlsConfigs(...configs: Array<HlsConfig | null | undefined>): HlsConfig {
  return configs.reduce<HlsConfig>((acc, cfg) => {
    if (!cfg) return acc;
    return { ...acc, ...cfg };
  }, {});
}
