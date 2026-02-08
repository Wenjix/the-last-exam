## 1. Contracts and Shared Types

- [ ] 1.1 Define match lifecycle REST and WS contracts in `packages/contracts` for create/get, phase updates, round results, and match completion
- [ ] 1.2 Define bid/equip submission contracts with idempotency fields and machine-readable validation errors
- [ ] 1.3 Define runner callback/result contracts including harness outputs, execution metadata, and score breakdown fields
- [ ] 1.4 Define replay API payload contracts for ordered event timelines and persisted artifact references

## 2. Deterministic Core Rules (`packages/game-core`)

- [ ] 2.1 Implement deterministic FSM for five-round progression with fixed phase sequence (briefing -> hidden bid -> bid resolve -> equip -> run -> resolve)
- [ ] 2.2 Implement server-deadline phase timing model and transition guards based on authoritative clock inputs
- [ ] 2.3 Implement hidden bid storage/resolution with stable deterministic tie-break precedence
- [ ] 2.4 Implement equip validation against resolved tool ownership and round constraints
- [ ] 2.5 Implement correctness-first scoring functions with failure gating and bounded optional bonus clamping
- [ ] 2.6 Implement deterministic standings finalization and match completion logic after round five

## 3. Authoritative Server (`apps/server`)

- [ ] 3.1 Wire match create/get, bid submit, equip submit, and replay fetch endpoints to shared contracts
- [ ] 3.2 Implement WS event stream emission for phase transitions, round outcomes, commentary updates, and final standings
- [ ] 3.3 Implement action idempotency handling for bid/equip submissions and runner callbacks
- [ ] 3.4 Integrate server orchestration loop with `game-core` reducers and deadline-driven phase advancement
- [ ] 3.5 Persist ordered event log entries with monotonic sequence IDs for every authoritative state transition

## 4. Runner and Scoring Integration (`apps/runner` + server bridge)

- [ ] 4.1 Implement runner intake and callback pipeline that includes challenge/hazard/tool context snapshots per agent
- [ ] 4.2 Execute harness evaluation and return structured objective outputs used by scoring authority
- [ ] 4.3 Enforce local sandbox limits (time, CPU, memory, disk, no network) and map failures to structured statuses
- [ ] 4.4 Implement fallback mock-result path for generation/execution failures without blocking round resolution
- [ ] 4.5 Persist run artifacts and score component details before applying final round standings

## 5. Commentary and Audio Pipeline

- [ ] 5.1 Implement event-triggered commentary generation pipeline with round/phase context
- [ ] 5.2 Implement heartbeat summary scheduling during run phase when no major events occur
- [ ] 5.3 Add commentary rate limiting and backpressure handling to prevent client flooding
- [ ] 5.4 Ensure commentary failures/timeouts are non-blocking for phase transitions and scoring
- [ ] 5.5 Integrate Gemini-only audio generation/playback path with text fallback compatibility

## 6. Replay and Persistence

- [ ] 6.1 Implement persistence schema/adapters for events, run artifacts, score breakdowns, and final standings (SQLite-first, Postgres-compatible)
- [ ] 6.2 Implement replay reconstruction service that rehydrates timelines from stored events and artifacts only
- [ ] 6.3 Ensure replay path never invokes code generation or execution pipelines
- [ ] 6.4 Expose replay endpoint that returns authoritative ordered events for deterministic client playback

## 7. Web Gameplay Vertical Slice (`apps/web`)

- [ ] 7.1 Build phase UI states for briefing, hidden bid, bid resolve, equip, run, resolve, and final standings
- [ ] 7.2 Implement countdown rendering from server-issued deadlines rather than local phase ownership
- [ ] 7.3 Implement bid and equip interactions with validation error handling from API responses
- [ ] 7.4 Implement WS-driven read-model reducer for live phase/result/commentary updates
- [ ] 7.5 Implement replay timeline view consuming ordered replay event payloads

## 8. Verification and Demo Hardening

- [ ] 8.1 Add deterministic unit tests for seeded bidding, tie-break resolution, scoring gates, and final standings
- [ ] 8.2 Add integration test covering a full five-round match via API + WS with mocked runner outputs
- [ ] 8.3 Add integration test covering replay reconstruction consistency from persisted events/artifacts
- [ ] 8.4 Add failure-path tests for runner timeout/failure and commentary timeout to verify non-blocking gameplay
- [ ] 8.5 Add CI checks that enforce clean-room guardrails (legacy branding filter, contract/test pass gates)
