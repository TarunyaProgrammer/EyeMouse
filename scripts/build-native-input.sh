#!/bin/zsh
set -euo pipefail

project_root="${0:A:h}/.."
output="${project_root}/native/macos/input/eyemouse-input"
module_cache="${project_root}/.cache/module-cache"
mkdir -p "${module_cache}"

CLANG_MODULE_CACHE_PATH="${module_cache}" swiftc \
  -O \
  -target "arm64-apple-macosx14.0" \
  -framework ApplicationServices \
  -framework CoreGraphics \
  "${project_root}/native/macos/input/main.swift" \
  -o "${output}"

echo "Built ${output}"
