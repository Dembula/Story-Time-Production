export {
  getClientCaptureProtectionConfig,
  getServerCaptureProtectionConfig,
  type CaptureProtectionConfig,
  type CaptureProtectionMode,
} from "./config";
export { buildHlsDrmConfig } from "./hls-drm";
export {
  hardenVideoElement,
  isScreenCaptureActive,
  registerCaptureHandle,
  subscribeScreenCaptureChanges,
} from "./video-hardening";
