## Why

The project needs a clear, testable contract for the MVP game loop so implementation can proceed without drifting from the frozen architecture decisions. Defining this now aligns server, runner, and web work around deterministic scoring, timed phases, and replayability for the hackathon demo.

## What Changes

- Define the single-player five-round match loop (`1 human + 3 bot managers`) with fixed phase structure and round pacing targets.
- Introduce hidden bidding and equip flow where all managers bid on tools privately, then equip agents before execution.
- Specify run outcome authority as harness-first deterministic scoring with correctness gating and optional bounded LLM style/readability bonus.
- Define live round commentary behavior as event-triggered, rate-limited updates that do not block gameplay.
- Define replay requirements based on persisted events and artifacts (no rerun regeneration) for deterministic reconstruction.
- Capture integration boundaries across web client, authoritative server, runner sandbox, shared contracts, and content packs.

## Capabilities

### New Capabilities
- `five-round-match-loop`: Server-authoritative lifecycle for a full five-round match with fixed phase sequencing, timing windows, and round/result transitions.
- `hidden-bid-and-equip`: Secret tool bidding, deterministic bid resolution, and equip validation for one human manager and three bot managers each round.
- `harness-first-scoring`: Deterministic scoring pipeline where executable harness correctness is primary, failures are heavily capped/zeroed, and bounded judge bonus cannot override correctness.
- `live-commentary-stream`: Continuous-feel commentary stream driven by game events plus heartbeat summaries with rate limits and non-blocking behavior.
- `event-log-replay`: Durable event/artifact persistence and replay reconstruction that reproduces match outcomes from stored records rather than regenerated runs.

### Modified Capabilities
- None.

## Impact

- Affected code:
  - `packages/game-core` for deterministic FSM, timing, bidding/equip rules, and scoring logic.
  - `packages/contracts` for API/WS event schemas and replay payload contracts.
  - `apps/server` for authoritative phase orchestration, idempotent actions, and persistence writes.
  - `apps/runner` for challenge execution/harness integration within sandbox limits.
  - `apps/web` for phase UI, timers, bid/equip UX, run/result display, and replay view.
  - `packages/content`, `packages/ai`, and `packages/audio` for hazards/tools/challenges, commentary generation, and Gemini-only audio path.
- APIs and data:
  - REST and WebSocket contracts for match lifecycle, submissions, results, commentary, and replay event streams.
  - Durable storage for ordered events, run artifacts, score breakdowns, and final standings.
- Dependencies/systems:
  - Requires deterministic shared rules and seed handling.
  - Requires local-first isolated execution sandbox with strict resource/network limits.
  - Keeps MVP provider scope constrained (single audio provider, no on-chain/wallet/voting systems).
