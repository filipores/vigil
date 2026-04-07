#!/bin/bash
# Vigil Autonomous QA Loop — explores, tests, fixes until clean.
# Usage: ./scripts/qa-loop.sh [--target PROJECT_PATH]
# Stop: Ctrl+C
set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO="$(dirname "$SCRIPT_DIR")"
TARGET="${1:-/Users/filipores/_Coding/obojobs}"

LOG_DIR="${QA_LOG_DIR:-$REPO/.qa-runs}"
STATE_FILE="$LOG_DIR/state.json"
MAX_CONSECUTIVE_CLEAN=2
COOLDOWN_BETWEEN_RUNS=30

mkdir -p "$LOG_DIR"
echo '{}' > "$LOG_DIR/retries.json" 2>/dev/null || true

# State
run=0; clean_streak=0; current_phase="init"

load_state() {
  [ -f "$STATE_FILE" ] || return 0
  run=$(jq -r '.current_run // 0' "$STATE_FILE")
  clean_streak=$(jq -r '.clean_streak // 0' "$STATE_FILE")
  current_phase=$(jq -r '.current_phase // "explore"' "$STATE_FILE")
  echo "[Resume] Run #$run, Phase: $current_phase"
}

save_state() {
  current_phase="$1"
  jq -n --argjson run "$run" --arg phase "$1" --argjson streak "$clean_streak" \
    --arg ts "$(date -Iseconds)" \
    '{current_run:$run, current_phase:$phase, clean_streak:$streak, timestamp:$ts}' \
    > "$STATE_FILE.tmp" && mv "$STATE_FILE.tmp" "$STATE_FILE"
}

output_matches() { echo "$1" | grep -qi "$2"; }

ensure_services() {
  echo "[Check] Verifying services..."

  # Server
  if ! curl -sf http://localhost:3001/api/functions > /dev/null 2>&1; then
    echo "[Start] Server..."
    cd "$REPO"
    MONITOR_ROOT="$TARGET" npm run dev -w packages/server > "$LOG_DIR/server.log" 2>&1 &
    sleep 3
  fi

  # Dashboard
  if ! curl -sf http://localhost:3000 > /dev/null 2>&1; then
    echo "[Start] Dashboard..."
    cd "$REPO"
    npm run dev -w packages/dashboard > "$LOG_DIR/dashboard.log" 2>&1 &
    sleep 5
  fi

  # SDK
  if [ "$(curl -sf http://localhost:3001/api/functions 2>/dev/null | jq 'length' 2>/dev/null || echo 0)" = "0" ]; then
    echo "[Start] SDK monitoring $TARGET..."
    cd "$REPO"
    cat > "$LOG_DIR/monitor-target.ts" <<EOFTS
import { monitor } from '@agent-monitor/sdk';
monitor({ root: '${TARGET}/frontend/src', serverUrl: 'ws://localhost:3001/ws' });
console.log('SDK monitoring ${TARGET}');
process.on('SIGINT', () => process.exit(0));
EOFTS
    npx tsx "$LOG_DIR/monitor-target.ts" > "$LOG_DIR/sdk.log" 2>&1 &
    sleep 5
  fi

  local fn_count
  fn_count=$(curl -sf http://localhost:3001/api/functions 2>/dev/null | jq 'length' 2>/dev/null || echo 0)
  echo "[Ready] $fn_count functions tracked"
}

run_claude() {
  local prompt log
  prompt="$(cat "$1")"
  log="$LOG_DIR/run-${run}-$(date +%Y%m%d-%H%M%S).log"

  echo "[Claude] Running QA exploration... ($(date))"
  local output
  output=$(claude -p "$prompt" \
    --allowedTools "Bash,Read,Edit,Write,Glob,Grep,Agent,mcp__playwright__*" \
    --mcp-config "$SCRIPT_DIR/qa-mcp.json" \
    --output-format json 2>&1) || true
  echo "$output" >> "$log"

  if output_matches "$output" "rate_limit\|429\|overloaded\|529"; then
    echo "RATE_LIMITED"; return
  fi

  echo "$output" | jq -r '.result // empty' 2>/dev/null || echo "$output"
}

run_qa_iteration() {
  run=$((run + 1))
  echo ""
  echo "═══════════════════════════════════════════════"
  echo "  Vigil QA Run #$run — $(date '+%H:%M:%S')"
  echo "═══════════════════════════════════════════════"

  ensure_services
  save_state "explore"

  local result
  result=$(run_claude "$SCRIPT_DIR/qa-prompt.md")

  case "$result" in
    RATE_LIMITED)
      echo "[Rate Limited] Sleeping 1h..."
      sleep 3600
      return 1
      ;;
  esac

  # Claude returns markdown with embedded JSON — extract the JSON block first
  local json_block status
  json_block=$(echo "$result" | sed -n '/^```json/,/^```/p' | sed '1d;$d')
  if [ -n "$json_block" ]; then
    status=$(echo "$json_block" | jq -r '.status // "unknown"' 2>/dev/null || echo "unknown")
  else
    # Fallback: try direct jq parse, or grep for status
    status=$(echo "$result" | jq -r '.status // "unknown"' 2>/dev/null || echo "unknown")
    if [ "$status" = "unknown" ]; then
      echo "$result" | grep -qi "clean\|no.* issues\|0 findings" && status="clean"
    fi
  fi

  case "$status" in
    clean)
      clean_streak=$((clean_streak + 1))
      echo "[✓] Clean run #$clean_streak/$MAX_CONSECUTIVE_CLEAN"
      save_state "clean"
      (( clean_streak >= MAX_CONSECUTIVE_CLEAN )) && return 0
      ;;
    fixed)
      clean_streak=0
      local fixed_count
      fixed_count=$(echo "$result" | jq -r '.findings_fixed // 0' 2>/dev/null)
      echo "[Fixed] $fixed_count issues fixed"
      save_state "fixed"
      ;;
    blocked)
      clean_streak=0
      echo "[Blocked] Some issues could not be fixed"
      save_state "blocked"
      ;;
    *)
      echo "[?] Unknown status: $status"
      clean_streak=0
      save_state "unknown"
      ;;
  esac
  return 2
}

cleanup() {
  save_state "stopped"
  echo ""
  echo "[Done] QA loop stopped after $run runs."
}
trap cleanup EXIT

main() {
  echo "╔═══════════════════════════════════════╗"
  echo "║  Vigil QA Loop                        ║"
  echo "║  Target: $TARGET"
  echo "║  Logs:   $LOG_DIR"
  echo "╚═══════════════════════════════════════╝"
  echo ""

  cd "$REPO"
  load_state

  while true; do
    run_qa_iteration
    case $? in
      0) echo ""; echo "[✓✓] APP IS CLEAN after $run runs!"; exit 0 ;;
      1) echo "[Retry]..."; continue ;;
      2) echo "[Cooldown] ${COOLDOWN_BETWEEN_RUNS}s..."; sleep $COOLDOWN_BETWEEN_RUNS ;;
    esac
  done
}

main "$@"
