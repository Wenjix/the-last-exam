#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# h2x.3 — One-click demo script for The Last Exam
#
# Runs pre-seeded demo scenarios via the test harness. Each scenario uses a
# fixed seed to produce deterministic, interesting match outcomes.
#
# Usage:
#   ./scripts/demo.sh            # Run all demo scenarios
#   ./scripts/demo.sh --quick    # Run a single quick scenario
#   ./scripts/demo.sh --help     # Show help
#
# Prerequisites:
#   - Node.js >=20
#   - pnpm (npm i -g pnpm)
#   - Run `pnpm install` first
# ─────────────────────────────────────────────────────────────────────────────

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
cd "$PROJECT_ROOT"

# ── Colors ──────────────────────────────────────────────────────────────────
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# ── Helpers ─────────────────────────────────────────────────────────────────
info()    { echo -e "${BLUE}[INFO]${NC} $*"; }
success() { echo -e "${GREEN}[OK]${NC}   $*"; }
warn()    { echo -e "${YELLOW}[WARN]${NC} $*"; }
error()   { echo -e "${RED}[FAIL]${NC} $*"; }

banner() {
  echo ""
  echo -e "${CYAN}════════════════════════════════════════════════════════════${NC}"
  echo -e "${CYAN}  THE LAST EXAM — Demo Runner${NC}"
  echo -e "${CYAN}════════════════════════════════════════════════════════════${NC}"
  echo ""
}

usage() {
  echo "Usage: $0 [OPTIONS]"
  echo ""
  echo "Options:"
  echo "  --quick     Run a single quick demo scenario"
  echo "  --help      Show this help message"
  echo ""
  echo "Demo scenarios:"
  echo "  1. Dramatic Comeback  — Bot trailing in standings surges ahead in final rounds"
  echo "  2. Mistral Showcase   — Mistral Agent dominates with aggressive bidding"
  echo "  3. Close Finish       — All managers finish within 5% of each other"
  echo ""
}

# ── Arg parsing ─────────────────────────────────────────────────────────────
QUICK=false
for arg in "$@"; do
  case "$arg" in
    --quick) QUICK=true ;;
    --help)  usage; exit 0 ;;
    *)       error "Unknown option: $arg"; usage; exit 1 ;;
  esac
done

# ── Pre-flight checks ──────────────────────────────────────────────────────
banner

info "Checking prerequisites..."

if ! command -v node &>/dev/null; then
  error "Node.js not found. Please install Node.js >=20."
  exit 1
fi

NODE_VERSION=$(node -v | sed 's/v//' | cut -d. -f1)
if [ "$NODE_VERSION" -lt 20 ]; then
  error "Node.js >=20 required (found v$(node -v))"
  exit 1
fi

if ! command -v pnpm &>/dev/null; then
  error "pnpm not found. Install with: npm i -g pnpm"
  exit 1
fi

if [ ! -d "node_modules" ]; then
  warn "node_modules not found. Running pnpm install..."
  pnpm install
fi

success "Prerequisites OK"
echo ""

# ── Build ───────────────────────────────────────────────────────────────────
info "Building project..."
if pnpm tsc --build 2>/dev/null; then
  success "TypeScript build complete"
else
  warn "Build had warnings (continuing anyway)"
fi

# ── Run demo scenarios ──────────────────────────────────────────────────────

run_scenario() {
  local name="$1"
  local test_filter="$2"

  echo ""
  echo -e "${CYAN}──────────────────────────────────────────${NC}"
  echo -e "${CYAN}  Scenario: ${name}${NC}"
  echo -e "${CYAN}──────────────────────────────────────────${NC}"
  echo ""

  if pnpm vitest run --reporter=verbose -t "$test_filter" apps/server/src/__tests__/demo-scenarios.test.ts 2>&1; then
    success "Scenario '${name}' completed successfully"
  else
    error "Scenario '${name}' failed"
    return 1
  fi
}

FAILURES=0

if [ "$QUICK" = true ]; then
  info "Running quick demo (Mistral Showcase only)..."
  run_scenario "Mistral Showcase" "Mistral Showcase" || ((FAILURES++))
else
  info "Running all demo scenarios..."

  run_scenario "Dramatic Comeback"  "Dramatic Comeback"  || ((FAILURES++))
  run_scenario "Mistral Showcase"   "Mistral Showcase"   || ((FAILURES++))
  run_scenario "Close Finish"       "Close Finish"       || ((FAILURES++))
fi

# ── Summary ─────────────────────────────────────────────────────────────────
echo ""
echo -e "${CYAN}════════════════════════════════════════════════════════════${NC}"
if [ "$FAILURES" -eq 0 ]; then
  success "All demo scenarios passed!"
else
  error "${FAILURES} scenario(s) failed"
fi
echo -e "${CYAN}════════════════════════════════════════════════════════════${NC}"
echo ""

exit "$FAILURES"
