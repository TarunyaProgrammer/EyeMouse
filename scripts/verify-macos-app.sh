#!/usr/bin/env bash
set -euo pipefail

app_path="${1:-}"
if [[ -z "$app_path" || ! -d "$app_path" || "${app_path##*.}" != "app" ]]; then
  echo "Usage: $0 /path/to/EyeMouse.app" >&2
  exit 2
fi

helper_path="$app_path/Contents/Resources/native/eyemouse-input"
if [[ ! -x "$helper_path" ]]; then
  echo "Missing executable native helper: $helper_path" >&2
  exit 1
fi

codesign --verify --deep --strict --verbose=2 "$app_path"
codesign --verify --verbose=2 "$helper_path"
spctl --assess --type execute --verbose=2 "$app_path"
echo "Verified signed and accepted macOS application: $app_path"
