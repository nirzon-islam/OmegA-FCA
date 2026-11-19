"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { parseVersion, compareVersions, verifyArtifactDigest } = require("../src/update/manifest");

test("parses stable and prerelease semantic versions", () => {
  assert.deepEqual(parseVersion("1.2.3"), { major: 1, minor: 2, patch: 3, prerelease: "" });
  assert.deepEqual(parseVersion("2.0.0-beta.1"), { major: 2, minor: 0, patch: 0, prerelease: "beta.1" });
  assert.throws(() => parseVersion("1.2"));
  assert.throws(() => parseVersion("01.2.3"));
});

test("compares semantic versions and prereleases", () => {
  assert.equal(compareVersions("1.2.4", "1.2.3"), 1);
  assert.equal(compareVersions("1.2.3", "1.2.3"), 0);
  assert.equal(compareVersions("1.2.3-beta.2", "1.2.3-beta.1"), 1);
  assert.equal(compareVersions("1.2.3", "1.2.3-rc.1"), 1);
});

test("verifies artifact digests and rejects malformed expected hashes", () => {
  const bytes = Buffer.from("omega-fca-test");
  const crypto = require("node:crypto");
  const digest = crypto.createHash("sha256").update(bytes).digest("hex");
  assert.equal(verifyArtifactDigest(bytes, digest), true);
  assert.equal(verifyArtifactDigest(bytes, "bad-hash"), false);
});
