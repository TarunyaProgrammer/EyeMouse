#!/usr/bin/env bash
set -euo pipefail

required_variables=(
  CSC_LINK
  CSC_KEY_PASSWORD
  APPLE_ID
  APPLE_APP_SPECIFIC_PASSWORD
  APPLE_TEAM_ID
  GH_TOKEN
)

missing=()
for variable_name in "${required_variables[@]}"; do
  if [[ -z "${!variable_name:-}" ]]; then
    missing+=("$variable_name")
  fi
done

if (( ${#missing[@]} > 0 )); then
  printf 'Missing release environment variables: %s\n' "${missing[*]}" >&2
  exit 1
fi

if [[ ! -f "$CSC_LINK" ]]; then
  echo "CSC_LINK does not point to a certificate file: $CSC_LINK" >&2
  exit 1
fi

if ! security find-identity -v -p codesigning | grep -Fq 'Developer ID Application'; then
  echo "No Developer ID Application signing identity is available in the keychain." >&2
  exit 1
fi

echo "Release environment contains required credentials and a Developer ID Application identity."
