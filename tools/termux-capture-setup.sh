#!/data/data/com.termux/files/usr/bin/bash
set -euo pipefail

echo "OmegA FCA Termux capture setup"
if ! command -v pkg >/dev/null 2>&1; then
  echo "This helper must run inside Termux." >&2
  exit 1
fi
pkg update
pkg install -y nodejs-lts android-tools
if [ ! -f package.json ]; then
  echo "Run this script from the OmegA-FCA repository root." >&2
  exit 1
fi
npm ci
npm install --no-save playwright
echo
echo "Next: enable Android Wireless debugging, then run:"
echo "  adb pair PHONE_IP:PAIR_PORT"
echo "  adb connect PHONE_IP:DEBUG_PORT"
echo "  adb forward tcp:9222 localabstract:chrome_devtools_remote"
echo "Open Chrome on Android and verify:"
echo "  curl http://127.0.0.1:9222/json/version"
echo "Then capture:"
echo "  npm run capture:browser -- --cdp http://127.0.0.1:9222"
echo "Only continue if the CDP endpoint responds. Keep private frames off GitHub."
