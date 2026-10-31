#!/usr/bin/env bash
set -euo pipefail

app_path="${1:-apps/desktop/dist/mac-arm64/EyeMouse.app}"
if [[ ! -d "$app_path" || "${app_path##*.}" != "app" ]]; then
  echo "Usage: $0 /path/to/EyeMouse.app" >&2
  exit 2
fi

resources_path="$app_path/Contents/Resources"
asar_path="$resources_path/app.asar"
helper_path="$resources_path/native/eyemouse-input"
executable_path="$app_path/Contents/MacOS/EyeMouse"

for required_path in "$asar_path" "$helper_path" "$executable_path" "$resources_path/icon.icns"; do
  if [[ ! -e "$required_path" ]]; then
    echo "Missing packaged path: $required_path" >&2
    exit 1
  fi
done

if [[ ! -x "$helper_path" || ! -x "$executable_path" ]]; then
  echo "Packaged application or native helper is not executable." >&2
  exit 1
fi

bundle_id="$(/usr/libexec/PlistBuddy -c 'Print :CFBundleIdentifier' "$app_path/Contents/Info.plist")"
product_name="$(/usr/libexec/PlistBuddy -c 'Print :CFBundleName' "$app_path/Contents/Info.plist")"
[[ "$bundle_id" == "com.eyemouse.desktop" ]] || { echo "Unexpected bundle identifier: $bundle_id" >&2; exit 1; }
[[ "$product_name" == "EyeMouse" ]] || { echo "Unexpected product name: $product_name" >&2; exit 1; }

# The app is an asar archive, so inspect its embedded path table without requiring
# a global asar installation. These entries prove the local model/WASM payload and
# the CJS preload used by sandboxed BrowserWindows are present in the artifact.
for required_entry in "models/face_landmarker.task" "wasm/vision_wasm_internal.wasm" "preload/index.cjs"; do
  if ! grep -a -q "$required_entry" "$asar_path"; then
    echo "Missing asar entry: $required_entry" >&2
    exit 1
  fi
done

echo "Verified unsigned macOS package contents: $app_path"
