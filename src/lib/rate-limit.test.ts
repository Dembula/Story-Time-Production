import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { checkRateLimit } from "./rate-limit";

describe("rate-limit", () => {
  it("allows requests under the limit", async () => {
    const key = `test-${Date.now()}`;
    const first = await checkRateLimit({
      key,
      ip: "127.0.0.1",
      maxAttempts: 3,
      windowMs: 60_000,
    });
    assert.equal(first.allowed, true);
  });

  it("blocks after max attempts", async () => {
    const key = `block-${Date.now()}`;
    const ip = "10.0.0.1";
    for (let i = 0; i < 2; i += 1) {
      await checkRateLimit({ key, ip, maxAttempts: 2, windowMs: 60_000 });
    }
    const blocked = await checkRateLimit({ key, ip, maxAttempts: 2, windowMs: 60_000 });
    assert.equal(blocked.allowed, false);
    assert.ok(blocked.retryAfterSeconds >= 1);
  });
});
