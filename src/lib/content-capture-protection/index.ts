export {
  getClientCaptureProtectionConfig,
  getServerCaptureProtectionConfig,
  isServerDrmConfigured,
  resolveUpstreamLicenseUrl,
  resolveUpstreamFairplayCertificateUrl,
  DRM_LICENSE_PROXY_PATHS,
  type CaptureProtectionConfig,
  type CaptureProtectionMode,
  type DrmServerConfig,
  type DrmSystemKey,
} from "./config";
export { buildHlsDrmConfig } from "./hls-drm";
export {
  resolveDrmCapability,
  EME_KEY_SYSTEM_IDS,
  FAIRPLAY_LEGACY_KEY_SYSTEM,
  type PlaybackDrmDescriptor,
  type DrmCapability,
} from "./drm-systems";
export {
  attachNativeFairplay,
  fairplaySetupFromDescriptor,
} from "./fairplay-native";
export {
  hardenVideoElement,
  isScreenCaptureActive,
  registerCaptureHandle,
  subscribeScreenCaptureChanges,
} from "./video-hardening";
