export {
  getClientCaptureProtectionConfig,
  getServerCaptureProtectionConfig,
  hasFairPlayCertificate,
  type CaptureProtectionConfig,
  type CaptureProtectionMode,
} from "./config";
export { buildHlsDrmConfig } from "./hls-drm";
export { attachFairPlay, isFairPlaySupported, type FairPlayOptions } from "./fairplay";
export {
  hardenVideoElement,
  isScreenCaptureActive,
  registerCaptureHandle,
  subscribeScreenCaptureChanges,
} from "./video-hardening";
