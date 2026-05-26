import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  generateInviteToken,
  inviteExpiresAtDefault,
  isValidSuiteList,
  normalizeInviteEmail,
  STUDIO_SUITE_OPTIONS,
} from "./creator-team-invites";
import { safeCallbackPath, isStudioTeamJoinCallback } from "./auth-callback-path";

describe("normalizeInviteEmail", () => {
  it("trims and lowercases", () => {
    assert.equal(normalizeInviteEmail("  Team@Example.COM  "), "team@example.com");
  });
});

describe("isValidSuiteList", () => {
  it("accepts empty list", () => {
    assert.equal(isValidSuiteList([]), true);
  });

  it("accepts known suite ids", () => {
    assert.equal(isValidSuiteList(STUDIO_SUITE_OPTIONS.map((s) => s.id)), true);
  });

  it("rejects unknown ids", () => {
    assert.equal(isValidSuiteList(["not_a_suite"]), false);
  });

  it("rejects non-arrays", () => {
    assert.equal(isValidSuiteList("pipeline_pre"), false);
  });
});

describe("generateInviteToken", () => {
  it("produces unique hex tokens", () => {
    const a = generateInviteToken();
    const b = generateInviteToken();
    assert.notEqual(a, b);
    assert.match(a, /^[a-f0-9]{48}$/);
  });
});

describe("inviteExpiresAtDefault", () => {
  it("is about 14 days in the future", () => {
    const exp = inviteExpiresAtDefault();
    const days = (exp.getTime() - Date.now()) / (1000 * 60 * 60 * 24);
    assert.ok(days >= 13.9 && days <= 14.1);
  });
});

describe("safeCallbackPath", () => {
  it("allows internal paths", () => {
    assert.equal(safeCallbackPath("/creator/join/company/abc"), "/creator/join/company/abc");
  });

  it("blocks external and protocol-relative urls", () => {
    assert.equal(safeCallbackPath("https://evil.com"), null);
    assert.equal(safeCallbackPath("//evil.com"), null);
    assert.equal(safeCallbackPath(null), null);
  });

  it("blocks backslash paths", () => {
    assert.equal(safeCallbackPath("/\\evil"), null);
  });
});

describe("isStudioTeamJoinCallback", () => {
  it("detects company join links", () => {
    assert.equal(isStudioTeamJoinCallback("/creator/join/company/token123"), true);
    assert.equal(isStudioTeamJoinCallback("/creator/command-center"), false);
  });
});
