#!/usr/bin/env bash
#
# Pre-flight verification for a release AAB.
#
# Catches the two regressions that broke recent production releases:
#   1. Native .so files not aligned for 16 KB pages -> Play Store rejection.
#   2. AAB still produces a per-ABI split APK -> some OEM ROMs (OnePlus
#      Android 11 confirmed) fail to install it -> SoLoader DSONotFound
#      crash at MainActivity.onCreate.
#
# Usage:
#   scripts/verify-aab.sh path/to/app.aab
#
# Exits 0 on pass, non-zero on any failure.

set -euo pipefail

AAB="${1:-}"
[ -n "$AAB" ] || { echo "usage: $0 <path-to-aab>"; exit 2; }
[ -f "$AAB" ] || { echo "ERROR: AAB not found: $AAB"; exit 2; }

require() { command -v "$1" >/dev/null || { echo "ERROR: missing tool: $1"; exit 2; }; }
require unzip
require bundletool

# Locate llvm-readelf from any installed NDK.
NDK_ROOT="${ANDROID_HOME:-$HOME/Library/Android/sdk}/ndk"
READELF=""
if [ -d "$NDK_ROOT" ]; then
  # No -type f: BSD find on macOS treats symlinks as 'l' and excludes them,
  # but llvm-readelf is shipped as a symlink to llvm-readobj.
  for candidate in $(find "$NDK_ROOT" -name 'llvm-readelf' 2>/dev/null); do
    READELF="$candidate"
    break
  done
fi
[ -n "$READELF" ] || { echo "ERROR: llvm-readelf not found under $NDK_ROOT (install Android NDK)"; exit 2; }

WORK=$(mktemp -d)
trap 'rm -rf "$WORK"' EXIT

echo "=== Verifying $AAB ==="

# ---------- Check 1: ELF segment alignment ----------
unzip -q -o "$AAB" 'base/lib/arm64-v8a/*.so' -d "$WORK"
fail_align=0
for so in "$WORK"/base/lib/arm64-v8a/*.so; do
  # Don't use 'awk ... exit' inside a pipefail pipe — early exit raises SIGPIPE on readelf.
  align=$("$READELF" -l "$so" 2>/dev/null | grep -m1 -E '^[[:space:]]*LOAD' | awk '{print $NF}' || true)
  case "$align" in
    0x4000|0x10000) ;;  # 16 KB or 64 KB — both fine for 16 KB pages
    *) printf '  FAIL  %-40s align=%s\n' "$(basename "$so")" "$align"
       fail_align=$((fail_align + 1)) ;;
  esac
done
if [ "$fail_align" -gt 0 ]; then
  echo "ERROR: $fail_align native libs are not 16 KB-aligned. Play Store will reject."
  exit 1
fi
echo "  OK    all native libs are 16 KB page-aligned"

# ---------- Check 2: no per-ABI split APK in delivery ----------
APKS="$WORK/app.apks"
SPLITS="$WORK/splits"
bundletool build-apks --bundle="$AAB" --output="$APKS" --mode=default >/dev/null 2>&1
unzip -q -o "$APKS" -d "$WORK/apkbundle"
abi_splits=$(ls "$WORK/apkbundle/splits/" 2>/dev/null | grep -E '(arm64_v8a|armeabi|x86)' || true)
if [ -n "$abi_splits" ]; then
  echo "ERROR: AAB still generates per-ABI split APKs:"
  echo "$abi_splits" | sed 's/^/  /'
  echo "  -> Native libs may not reach all OEM devices."
  echo "  -> Set 'bundle { abi { enableSplit false } }' in app/build.gradle."
  exit 1
fi
echo "  OK    no per-ABI splits — native libs travel with base APK"

# ---------- Check 3: libreactnative.so / libhermes.so reachable from base ----------
# bundletool may produce multiple base-master*.apk shards; libs may live in any of them.
master_listing=""
for apk in "$WORK"/apkbundle/splits/base-master*.apk; do
  master_listing="$master_listing"$'\n'$(unzip -l "$apk")
done
for required in libreactnative.so libhermes.so; do
  case "$master_listing" in
    *"/$required"*) ;;
    *) echo "ERROR: $required not present in any base-master split."; exit 1 ;;
  esac
done
echo "  OK    libreactnative.so and libhermes.so present in base-master splits"

echo "=== AAB verification passed ==="
