import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { resolveDrmEndpoints, buildDrmClientHint, getDrmUpstreamLicenseUrl } from "./drm";

const ENV_KEYS = [
  "CAPTURE_PROTECTION_MODE",
  "STORYTIME_DRM_LICENSE_URL",
  "STORYTIME_DRM_FAIRPLAY_LICENSE_URL",
  "STORYTIME_DRM_FAIRPLAY_CERT_URL",
  "STORYTIME_DRM_WIDEVINE_LICENSE_URL",
  "STORYTIME_DRM_PLAYREADY_LICENSE_URL",
  "STORYTIME_DRM_AUTH_TOKEN",
  "CLOUDFLARE_STREAM_DRM_NATIVE",
  "CLOUDFLARE_ACCOUNT_ID",
  "CLOUDFLARE_STREAM_API_TOKEN",
  "CLOUDFLARE_STREAM_CUSTOMER_SUBDOMAIN",
] as const;

function saveEnv(): Record<string, string | undefined> {
  const snap: Record<string, string | undefined> = {};
  for (const key of ENV_KEYS) snap[key] = process.env[key];
  return snap;
}

function restoreEnv(snap: Record<string, string | undefined>) {
  for (const key of ENV_KEYS) {
    const value = snap[key];
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
}

describe("playback/drm", () => {
  let snap: Record<string, string | undefined>;

  beforeEach(() => {
    snap = saveEnv();
    for (const key of ENV_KEYS) delete process.env[key];
  });

  afterEach(() => {
    restoreEnv(snap);
  });

  it("returns disabled config when DRM mode is off", () => {
    process.env.STORYTIME_DRM_WIDEVINE_LICENSE_URL = "https://widevine.example/license";
    const summary = resolveDrmEndpoints(null);
    assert.equal(summary.enabled, false);
    const hint = buildDrmClientHint(summary);
    assert.equal(hint.enabled, false);
  });

  it("collects multiple DRM systems from explicit env URLs", () => {
    process.env.CAPTURE_PROTECTION_MODE = "drm";
    process.env.STORYTIME_DRM_WIDEVINE_LICENSE_URL = "https://widevine.example/license";
    process.env.STORYTIME_DRM_PLAYREADY_LICENSE_URL = "https://playready.example/license";
    process.env.STORYTIME_DRM_FAIRPLAY_LICENSE_URL = "https://fairplay.example/license";
    process.env.STORYTIME_DRM_FAIRPLAY_CERT_URL = "https://fairplay.example/cert";

    const summary = resolveDrmEndpoints(null);
    assert.equal(summary.enabled, true);
    assert.equal(getDrmUpstreamLicenseUrl(summary, "widevine"), "https://widevine.example/license");
    assert.equal(getDrmUpstreamLicenseUrl(summary, "fairplay"), "https://fairplay.example/license");
    assert.equal(getDrmUpstreamLicenseUrl(summary, "playready"), "https://playready.example/license");

    const hint = buildDrmClientHint(summary);
    assert.deepEqual(hint.systems.sort(), ["fairplay", "playready", "widevine"]);
    assert.equal(hint.proxy.licensePath, "/api/content/drm-license");
    assert.equal(hint.proxy.fairplayCertPath, "/api/content/drm-license/fairplay-cert");
  });

  it("derives Cloudflare-native DRM endpoints from a Stream UID", () => {
    process.env.CAPTURE_PROTECTION_MODE = "drm";
    process.env.CLOUDFLARE_STREAM_DRM_NATIVE = "true";
    process.env.CLOUDFLARE_ACCOUNT_ID = "acct-123";
    process.env.CLOUDFLARE_STREAM_API_TOKEN = "token";
    process.env.CLOUDFLARE_STREAM_CUSTOMER_SUBDOMAIN = "https://customer-abc.cloudflarestream.com";

    const uid = "0123456789abcdef0123456789abcdef";
    const summary = resolveDrmEndpoints(`https://videodelivery.net/${uid}/manifest/video.m3u8`);
    assert.ok(summary.endpoints.widevine?.licenseUrl?.includes(uid));
    assert.ok(summary.endpoints.fairplay?.certUrl?.includes(uid));
    assert.ok(summary.endpoints.playready?.licenseUrl?.endsWith("/playready"));
    assert.equal(summary.enabled, true);
  });

  it("falls back to legacy single license URL across all systems", () => {
    process.env.CAPTURE_PROTECTION_MODE = "drm";
    process.env.STORYTIME_DRM_LICENSE_URL = "https://multidrm.example/license";
    process.env.STORYTIME_DRM_FAIRPLAY_CERT_URL = "https://multidrm.example/cert";

    const summary = resolveDrmEndpoints(null);
    assert.equal(getDrmUpstreamLicenseUrl(summary, "widevine"), "https://multidrm.example/license");
    assert.equal(getDrmUpstreamLicenseUrl(summary, "playready"), "https://multidrm.example/license");
    assert.equal(getDrmUpstreamLicenseUrl(summary, "fairplay"), "https://multidrm.example/license");
  });
});
