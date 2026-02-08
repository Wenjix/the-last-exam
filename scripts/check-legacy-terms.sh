#!/usr/bin/env bash
set -euo pipefail

# De-branding guard: scan for forbidden legacy brand terms
# Ref: Architecture decision #19 (naming) and non-negotiable #5

# Configurable forbidden terms (pipe-separated for grep)
FORBIDDEN_TERMS="${FORBIDDEN_TERMS:-CodeClash|code-clash|codeclash|CODECLASH|Code Clash}"

# Directories to scan
SCAN_DIRS="apps packages src"

# File extensions to check
EXTENSIONS="ts tsx js jsx json yaml yml"

# Files/paths to exclude
EXCLUDE_PATTERNS=(
  "node_modules"
  "dist"
  "coverage"
  ".git"
  "pnpm-lock.yaml"
  "*.tsbuildinfo"
  "scripts/check-legacy-terms.sh"
  ".beads"
)

# Build find exclude args
EXCLUDE_ARGS=""
for pattern in "${EXCLUDE_PATTERNS[@]}"; do
  EXCLUDE_ARGS="$EXCLUDE_ARGS -not -path '*/$pattern' -not -path '*/$pattern/*' -not -name '$pattern'"
done

# Build find extension args
EXT_ARGS=""
for ext in $EXTENSIONS; do
  if [ -z "$EXT_ARGS" ]; then
    EXT_ARGS="-name '*.$ext'"
  else
    EXT_ARGS="$EXT_ARGS -o -name '*.$ext'"
  fi
done

found=0
total_matches=0

echo "🔍 Scanning for forbidden legacy terms..."
echo "   Terms: $FORBIDDEN_TERMS"
echo ""

# Find and scan files
for dir in $SCAN_DIRS; do
  if [ ! -d "$dir" ]; then
    continue
  fi

  while IFS= read -r file; do
    if matches=$(grep -n -E "$FORBIDDEN_TERMS" "$file" 2>/dev/null); then
      echo "❌ $file:"
      echo "$matches" | while IFS= read -r match; do
        echo "   $match"
        total_matches=$((total_matches + 1))
      done
      found=1
    fi
  done < <(eval "find '$dir' -type f \( $EXT_ARGS \) $EXCLUDE_ARGS 2>/dev/null")
done

# Also scan root-level files
for ext in $EXTENSIONS; do
  for file in *."$ext"; do
    if [ -f "$file" ]; then
      skip=false
      for pattern in "${EXCLUDE_PATTERNS[@]}"; do
        if [[ "$file" == *"$pattern"* ]]; then
          skip=true
          break
        fi
      done
      if [ "$skip" = true ]; then continue; fi

      if matches=$(grep -n -E "$FORBIDDEN_TERMS" "$file" 2>/dev/null); then
        echo "❌ $file:"
        echo "$matches" | while IFS= read -r match; do
          echo "   $match"
        done
        found=1
      fi
    fi
  done
done

echo ""
if [ "$found" -eq 1 ]; then
  echo "❌ FAILED: Forbidden legacy brand terms detected!"
  echo "   Please remove all references to legacy brand names."
  echo "   See: Architecture decision #19 and non-negotiable #5."
  exit 1
else
  echo "✅ PASSED: No forbidden legacy terms found."
  exit 0
fi
