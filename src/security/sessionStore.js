"use strict";

const fs = require("node:fs");
const path = require("node:path");
const { encryptSession, decryptSession } = require("./sessionCrypto");

function saveSession(filePath, session, key) {
  const target = path.resolve(filePath);
  const directory = path.dirname(target);
  fs.mkdirSync(directory, { recursive: true, mode: 0o700 });
  const temp = path.join(directory, ".omega-session-" + process.pid + "-" + Date.now() + ".tmp");
  const envelope = JSON.stringify(encryptSession(session, key));
  let fd;
  try {
    fd = fs.openSync(temp, "wx", 0o600);
    fs.writeFileSync(fd, envelope, "utf8");
    fs.fsyncSync(fd);
    fs.closeSync(fd);
    fd = undefined;
    fs.renameSync(temp, target);
    try { fs.chmodSync(target, 0o600); } catch {}
  } catch (error) {
    if (fd !== undefined) try { fs.closeSync(fd); } catch {}
    try { fs.unlinkSync(temp); } catch {}
    throw error;
  }
  return target;
}

function loadSession(filePath, key) {
  const target = path.resolve(filePath);
  const stat = fs.statSync(target);
  if (!stat.isFile() || stat.size > 1024 * 1024) throw new Error("Encrypted session file is invalid or too large");
  const envelope = JSON.parse(fs.readFileSync(target, "utf8"));
  return decryptSession(envelope, key);
}

function deleteSession(filePath) {
  try { fs.unlinkSync(path.resolve(filePath)); }
  catch (error) { if (error.code !== "ENOENT") throw error; }
}

module.exports = { saveSession, loadSession, deleteSession };
