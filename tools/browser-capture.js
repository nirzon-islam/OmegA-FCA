"use strict";

// Owner-operated browser capture. Never sends data to a remote service.
const fs = require("node:fs");
const path = require("node:path");

const OUT_DIR = path.resolve(process.cwd(), ".omega-capture");
const PRIVATE_DIR = path.join(OUT_DIR, "private");
const SAVE_PRIVATE = process.argv.includes("--save-private-frames");
const cdpArg = process.argv.findIndex(arg => arg === "--cdp");
const CDP_URL = cdpArg >= 0 ? process.argv[cdpArg + 1] : process.env.OMEGA_CDP_URL;
const MAX_TEXT = 2048;

function safeUrl(input) {
  try {
    const u = new URL(input);
    return { origin: u.origin, path: u.pathname.slice(0, 300) };
  } catch { return { origin: "invalid", path: "" }; }
}
function safeText(value) {
  return String(value).slice(0, MAX_TEXT)
    .replace(/(c_user|xs|datr|fr|sb|wd|presence|fb_dtsg|lsd|jazoest|access_token|auth_token|password|passwd|cookie)(\s*[=:]\s*)[^\s&;,"]+/ig, "$1$2[REDACTED]")
    .replace(/\b[A-F0-9]{32,}\b/gi, "[LONG_HEX_REDACTED]")
    .replace(/\b\d{8,}\b/g, "[LONG_NUMBER_REDACTED]");
}
function writeJson(file, value) {
  fs.writeFileSync(file, JSON.stringify(value, null, 2) + "\n", { mode: 0o600 });
}

async function main() {
  let chromium;
  try { ({ chromium } = require("playwright")); }
  catch {
    process.stderr.write("Playwright is missing. Run: npm install && npx playwright install chromium\n");
    process.exitCode = 1;
    return;
  }
  fs.mkdirSync(OUT_DIR, { recursive: true, mode: 0o700 });
  if (SAVE_PRIVATE) fs.mkdirSync(PRIVATE_DIR, { recursive: true, mode: 0o700 });

  const report = {
    tool: "OmegA FCA Browser Capture",
    createdAt: new Date().toISOString(),
    mode: SAVE_PRIVATE ? "sanitized-report-plus-local-private-frames" : "sanitized-report-only",
    note: "No passwords, cookies, query strings, request bodies, or response bodies are included in this report.",
    requests: [], sockets: [], consoleErrors: []
  };
  const browser = CDP_URL
    ? await chromium.connectOverCDP(CDP_URL)
    : await chromium.launch({ headless: false });
  const context = browser.contexts()[0] || await browser.newContext();
  const page = context.pages()[0] || await context.newPage();
  let frameIndex = 0;

  page.on("request", request => {
    const u = safeUrl(request.url());
    report.requests.push({
      at: new Date().toISOString(), method: request.method(),
      ...u, resourceType: request.resourceType()
    });
  });
  page.on("response", response => {
    const req = response.request();
    const u = safeUrl(response.url());
    const headers = response.headers();
    report.requests.push({
      at: new Date().toISOString(), response: true, status: response.status(),
      method: req.method(), ...u,
      contentType: headers["content-type"] || null
    });
  });
  page.on("websocket", ws => {
    const entry = { at: new Date().toISOString(), ...safeUrl(ws.url()), frames: [] };
    report.sockets.push(entry);
    ws.on("framereceived", frame => recordFrame(entry, "in", frame));
    ws.on("framesent", frame => recordFrame(entry, "out", frame));
    ws.on("close", () => { entry.closedAt = new Date().toISOString(); });
  });
  page.on("console", msg => {
    if (msg.type() === "error" && report.consoleErrors.length < 100) {
      report.consoleErrors.push(safeText(msg.text()));
    }
  });

  function recordFrame(socket, direction, frame) {
    const payload = frame.payload;
    const isText = typeof payload === "string";
    const bytes = isText ? Buffer.from(payload, "utf8") : Buffer.from(payload);
    const item = {
      at: new Date().toISOString(), direction, kind: isText ? "text" : "binary",
      bytes: bytes.length, index: ++frameIndex
    };
    if (isText) item.preview = safeText(payload);
    socket.frames.push(item);
    if (SAVE_PRIVATE) {
      const file = path.join(PRIVATE_DIR, "frames.ndjson");
      fs.appendFileSync(file, JSON.stringify({
        index: item.index, at: item.at, direction, kind: item.kind,
        payload: isText ? payload : bytes.toString("base64")
      }) + "\n", { mode: 0o600 });
    }
  }

  let stopping = false;
  async function stop() {
    if (stopping) return;
    stopping = true;
    report.finishedAt = new Date().toISOString();
    writeJson(path.join(OUT_DIR, "capture-report.json"), report);
    await browser.close();
    process.exit(0);
  }
  process.once("SIGINT", stop);
  process.once("SIGTERM", stop);

  process.stdout.write("Browser opened. Log in to Facebook/Messenger manually.\n");
  process.stdout.write("Open Messenger and reproduce the actions needed for the capture.\n");
  process.stdout.write(SAVE_PRIVATE
    ? "WARNING: private raw frame payloads are being saved locally; they may contain secrets or message data.\n"
    : "Only sanitized frame metadata/previews are recorded. For binary protocol analysis, rerun with --save-private-frames and keep that folder private.\n");
  process.stdout.write("Press Ctrl+C when finished. Report: .omega-capture/capture-report.json\n");

  if (!CDP_URL) await page.goto("https://www.facebook.com/", { waitUntil: "domcontentloaded" });
  await new Promise(() => {});
}

main().catch(error => {
  process.stderr.write("Capture browser failed: " + safeText(error.message) + "\n");
  process.exitCode = 1;
});
