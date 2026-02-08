# The Last Exam - Initial Phased Implementation Plan

## Goal

Ship a playable hackathon demo with the minimum architecture and services required by the locked decisions.

## Phase 0: Clean-Room Bootstrap

### Objective
Start a new monorepo with only required architecture and no legacy feature carryover.

### Scope
1. Create `apps/web`, `apps/server`, `apps/runner`.
2. Create `packages/game-core`, `packages/contracts`, `packages/content`, `packages/ai`, `packages/audio`, `packages/testkit`.
3. Set up TypeScript project references, linting, testing, workspace scripts, and CI.
4. Add de-branding CI guard for forbidden legacy terms.

### Exit Criteria
1. Repo builds and typechecks with one command.
2. CI passes.
3. Forbidden-term guard is active.

## Phase 1: Core Contracts and Rules Engine

### Objective
Lock deterministic game rules before UI/backend complexity.

### Scope
1. Implement shared API and WS schemas in `packages/contracts`.
2. Implement FSM, seeded RNG, phase timing defaults, auction resolution, equip validation, trait reveal cadence, and score formula in `packages/game-core`.
3. Add schema-validated content loaders in `packages/content`.

### Exit Criteria
1. Deterministic unit tests pass for seeded inputs.
2. One full 5-round pure simulation passes in `game-core`.

## Phase 2: Authoritative Server Vertical Slice

### Objective
Build server-authoritative loop with mock run results.

### Scope
1. Implement REST endpoints for match create/get, bid submit, equip submit, replay fetch.
2. Implement WS event stream for phase transitions and round results.
3. Add in-memory active state with phase timers and idempotency.
4. Persist event log and final results to minimal DB (SQLite first, Postgres-compatible abstraction).

### Exit Criteria
1. End-to-end API test completes a 5-round match with mocked run outputs.
2. Replay endpoint returns ordered events.

## Phase 3: Web Client Gameplay Vertical Slice

### Objective
Make the game playable against mocked runner outputs.

### Scope
1. Build phase UI for briefing, hidden bid, bid resolve, equip, run, resolve, final standings.
2. Add countdown timers synced to server deadlines.
3. Add local read-model reducer from WS events.
4. Add bid/equip interactions with validation error handling.

### Exit Criteria
1. Human player can complete a full 5-round match in browser against 3 bots.

## Phase 4: Runner Service and Execution Sandbox

### Objective
Replace mock runs with real code generation and execution.

### Scope
1. Implement runner job intake and callback contract.
2. Build local sandbox path with strict limits (time, CPU, memory, disk, no network).
3. Implement challenge harness execution for 5 selected tasks.
4. Add graceful fallback that emits structured mock result on generation/execution failure.

### Exit Criteria
1. Run phase executes real submissions and returns per-agent results within 60s cap.

## Phase 5: Scoring Authority and Bot Managers

### Objective
Make outcomes fair, strategic, and demo-legible.

### Scope
1. Implement harness-first scoring with correctness gating.
2. Add optional bounded LLM bonus scoring (style/readability only).
3. Implement deterministic bot policies for bidding and equip.
4. Integrate 8 tools and 5 hazards into run/scoring modifiers.

### Exit Criteria
1. Same seed plus same artifacts reproduces same standings in replay.
2. Bot submissions are valid in all rounds.

## Phase 6: Live Commentary and Audio

### Objective
Deliver spectator experience without destabilizing gameplay loop.

### Scope
1. Implement event-triggered commentary with heartbeat summaries.
2. Stream rate-limited text updates during run phase.
3. Integrate Gemini-only audio generation and playback queue.
4. Add client controls (mute, volume, autoplay) and text fallback.

### Exit Criteria
1. Commentary runs round start to round end with stable latency.
2. Commentary cannot block phase transitions.

## Phase 7: Persistence, Replay, and Hardening

### Objective
Improve reliability and debuggability for live demo execution.

### Scope
1. Persist run artifacts, score breakdowns, and final standings.
2. Build replay reconstruction from stored events/artifacts (no regeneration).
3. Add structured logs, error taxonomy, and runner-timeout handling.
4. Add idempotency and phase-guard integration tests.

### Exit Criteria
1. Matches replay after server restart.
2. Core failure paths degrade cleanly.

## Phase 8: Balance, Polish, and Demo Readiness

### Objective
Tune game feel and reliability for hackathon showcase.

### Scope
1. Balance challenge/hazard ordering and intensity across rounds.
2. Tune commentary cadence and round pacing.
3. Prepare one-click demo scripts and scripted scenarios.
4. Resolve top gameplay clarity and stability defects.

### Exit Criteria
1. Three consecutive full matches run without critical failure.
2. Session duration and pacing match target expectations.
3. Outcome variance is visible and strategically coherent.

## 72-Hour Hackathon Cut

### Day 1
1. Complete Phase 0, 1, and 2 with mocked runs.
2. Milestone: server-authoritative 5-round loop works via API + WS.

### Day 2
1. Complete Phase 3 and 4.
2. Milestone: browser playable with real run execution.

### Day 3
1. Complete Phase 5, 6, and selective hardening from Phase 7/8.
2. Milestone: full demo with tools, hazards, bots, commentary, and replay basics.

## Parallel Workstreams

1. Agent A: `packages/game-core` + `packages/contracts` + determinism tests.
2. Agent B: `apps/server` FSM/API/WS + idempotency + persistence adapter.
3. Agent C: `apps/web` phase UI + WS reducer + timer sync.
4. Agent D: `apps/runner` sandbox + harness execution + scoring integration.
5. Agent E: `packages/audio` + commentary pipeline + fallback handling.

## Phase Gates

1. Do not start Phase 4 until Phase 2 integration tests pass.
2. Do not enable LLM bonus scoring until harness correctness is stable.
3. Do not add more content until core set (5 challenges, 5 hazards, 8 tools) is stable.
4. Do not add new game modes before single-player loop is stable.
5. Do not add extra providers before Gemini-only audio is reliable.

