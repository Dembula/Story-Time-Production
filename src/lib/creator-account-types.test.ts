import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  CREATOR_SIGNIN_ROLE_OPTIONS,
  CREATOR_SIGNUP_TYPE_TO_ROLE,
  isCreatorSignInRole,
} from "@/lib/creator-account-types";
import { CREATOR_ROLES } from "@/lib/user-roles-shared";
import { defaultHomeForRole, defaultCreatorRoleForPath } from "@/lib/auth-sign-in-path";

describe("creator account types", () => {
  it("maps every signup type to a CREATOR_ROLES member", () => {
    for (const role of Object.values(CREATOR_SIGNUP_TYPE_TO_ROLE)) {
      assert.equal(CREATOR_ROLES.has(role), true, `missing CREATOR_ROLES entry for ${role}`);
    }
  });

  it("includes festival curator in sign-in options", () => {
    assert.equal(
      CREATOR_SIGNIN_ROLE_OPTIONS.some((o) => o.value === "FESTIVAL_CURATOR"),
      true,
    );
    assert.equal(isCreatorSignInRole("FESTIVAL_CURATOR"), true);
    assert.equal(isCreatorSignInRole("SUBSCRIBER"), false);
  });

  it("routes festival paths and homes correctly", () => {
    assert.equal(defaultCreatorRoleForPath("/festival/team"), "FESTIVAL_CURATOR");
    assert.equal(defaultHomeForRole("FESTIVAL_CURATOR"), "/festival");
    assert.equal(defaultHomeForRole("CONTENT_CREATOR"), "/creator/command-center");
  });
});
