"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { saveSession, loadSession, deleteSession } = require("../src/security/sessionStore");

test("stores session encrypted and reloads it", () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "omega-fca-"));
  const file = path.join(directory, "session.enc");
  const session = { accountId: "123456", appState: [{ key: "xs", value: "synthetic-cookie" }] };
  try {
    saveSession(file, session, "c".repeat(64));
    const disk = fs.readFileSync(file, "utf8");
    assert.equal(disk.includes("synthetic-cookie"), false);
    assert.deepEqual(loadSession(file, "c".repeat(64)), session);
    assert.throws(() => loadSession(file, "d".repeat(64)));
    deleteSession(file);
    assert.equal(fs.existsSync(file), false);
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});
