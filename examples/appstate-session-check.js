"use strict";

const { loadAccountConfig, createPersonalSession } = require("../index");

async function main() {
  const account = loadAccountConfig();
  if (account.mode !== "appstate") {
    throw new Error("This test is AppState-only. Put an authorized cookie export in account.txt or appstate.json.");
  }

  let session;
  try {
    session = await createPersonalSession({ appState: account.appState });
    console.log("OmegA-FCA AppState validation: SUCCESS");
    console.log("Facebook user ID:", session.userId);
    console.log("Session state:", session.state);
    console.log("Validated at:", new Date(session.validatedAt).toISOString());
    console.log("No cookie values or session tokens were printed.");
  } catch (error) {
    console.error("OmegA-FCA AppState validation: FAILED");
    console.error("Code:", error.code || "FCA_SESSION_VALIDATION_FAILED");
    console.error("State:", error.sessionState || "unknown");
    console.error("Reason:", error.message);
    process.exitCode = 1;
  } finally {
    if (session) session.close();
  }
}

main().catch(error => {
  console.error("AppState test could not start:", error.message);
  process.exitCode = 1;
});
