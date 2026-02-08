## Context

This change defines a cross-cutting MVP architecture for The Last Exam: one human manager versus three deterministic bot managers across five rounds. The flow must remain server-authoritative, deterministic in core rules, and replayable from persisted events/artifacts without re-running generation. The implementation spans `packages/game-core`, `packages/contracts`, `apps/server`, `apps/runner`, `apps/web`, plus content/commentary/audio packages, and must preserve the locked constraints around phase timing, harness-first scoring, local sandboxing, and Gemini-only audio.

## Goals / Non-Goals

**Goals:**
- Establish a deterministic, server-authoritative match lifecycle with fixed phase sequencing and round deadlines.
- Define technical contracts for hidden bidding, equip validation, run result ingestion, scoring, commentary streaming, and replay.
- Keep replay fidelity by persisting the authoritative event stream and run artifacts needed for deterministic reconstruction.
- Support hackathon delivery by enabling phased vertical slices (mocked run first, real runner later) without changing contracts.

**Non-Goals:**
- Multiplayer modes or additional human managers in MVP.
- Replacing harness-first authority with judge-only or subjective scoring.
- Adding non-Gemini audio providers or on-chain/wallet/voting systems.
- Expanding scope beyond initial content targets (5 challenges, 5 hazards, 8 tools) in this change.

## Decisions

### 1) Deterministic core in shared `game-core`, orchestration in `apps/server`
Core round/phase transitions, timing defaults, bidding resolution rules, equip validation, and score formula live in `packages/game-core`. `apps/server` is the single authority that applies player actions, bot actions, and timer ticks against that core.

Rationale:
- Preserves deterministic logic in one shared module with testable pure simulation.
- Prevents UI or runner side effects from mutating authoritative game state.

Alternatives considered:
- Implementing rules only inside `apps/server` was rejected due to weaker reuse and harder deterministic unit testing.
- Full event-sourced domain framework was rejected for MVP complexity.

### 2) Deadline-based phase timing from server events
Server emits absolute phase deadlines; clients render countdowns against those deadlines. The server never trusts client clocks for phase completion.

Rationale:
- Avoids drift and race conditions from local timers.
- Keeps phase progression consistent for players, bots, and replay.

Alternatives considered:
- Client-owned timers were rejected due to skew and exploit risk.

### 3) Deterministic hidden bid and resolve mechanics
Bids are submitted privately per round, then resolved in a deterministic order with stable tie-breakers (seeded RNG plus canonical manager ordering).

Rationale:
- Keeps competitive secrecy while maintaining replay reproducibility.
- Eliminates non-repeatable outcomes from runtime randomness.

Alternatives considered:
- Runtime random tie-break without seed persistence was rejected because replay could diverge.

### 4) Runner contract persists full scoring inputs/outputs
Each run stores challenge/hazard/tool context snapshot, execution metadata, harness outputs, and score breakdown inputs before standings update.

Rationale:
- Replay and debugging require more than final aggregate scores.
- Enables deterministic re-scoring from recorded artifacts when needed.

Alternatives considered:
- Persisting only final round totals was rejected because auditability and replay explainability would be lost.

### 5) Harness-first scoring pipeline with gated bonus
Objective harness correctness determines base authority; failed/incorrect runs are heavily capped or zeroed. Optional LLM judge bonus (style/readability) is bounded and cannot overtake correctness outcomes.

Rationale:
- Keeps outcomes fair and executable-first.
- Allows commentary/demo legibility without compromising objective validity.

Alternatives considered:
- Weighted blended judge+harness authority was rejected as too subjective for MVP trust.

### 6) Commentary as asynchronous, rate-limited sidecar
Commentary generation consumes game events asynchronously with heartbeat summaries. Commentary failures/timeouts never block state transitions or score finalization.

Rationale:
- Preserves gameplay reliability under model/network variance.
- Delivers continuous spectator experience without coupling to core loop.

Alternatives considered:
- Synchronous commentary in the phase pipeline was rejected due to latency and failure coupling.

### 7) Replay from stored event log and artifacts only
Replay reconstructs state and presentation from persisted events and run artifacts, never by regenerating code or re-executing prompts.

Rationale:
- Guarantees reproducibility for same seed/artifacts.
- Supports debugging and post-match review even if model/runtime conditions change.

Alternatives considered:
- Replay-by-rerun was rejected because it violates determinism policy.

### 8) SQLite-first persistence with Postgres-compatible abstraction
MVP uses minimal relational persistence with an adapter abstraction to keep migration to Postgres straightforward.

Rationale:
- Reduces operational setup for hackathon demo.
- Avoids rewriting persistence contracts later.

Alternatives considered:
- Postgres-only now was rejected as higher setup cost for MVP timeline.

## Risks / Trade-offs

- [Runner execution exceeds round budget or fails unpredictably] -> Mitigation: strict sandbox limits, hard timeout, and structured fallback result path.
- [Event ordering/idempotency bugs cause replay divergence] -> Mitigation: monotonic event sequence IDs, idempotency keys for submissions, invariant tests on reconstruction.
- [Contract drift across server/web/runner] -> Mitigation: shared schemas in `packages/contracts`, generated types, and CI contract tests.
- [Commentary volume or latency harms UX] -> Mitigation: bounded queue, rate limits, heartbeat cadence, and text-first fallback.
- [Balance instability across hazards/tools/challenges] -> Mitigation: seeded simulation test matrix and phase-gate tuning before adding new content.

## Migration Plan

1. Implement Phase 0 repository and package scaffold with CI guards for clean-room constraints.
2. Deliver Phase 1 deterministic contracts and pure `game-core` simulation tests.
3. Deliver Phase 2 authoritative server loop with mocked run outputs and persisted event log.
4. Deliver Phase 3 playable web vertical slice using WS read-model and deadline timers.
5. Deliver Phase 4 real runner sandbox integration under the existing callback/result contract.
6. Deliver Phase 5 scoring authority finalization, deterministic bot policies, hazards/tools modifiers.
7. Deliver Phase 6 commentary streaming and Gemini audio integration as non-blocking sidecar.
8. Deliver Phase 7 replay/persistence hardening and failure-path integration tests.
9. Deliver Phase 8 balance/polish and demo scripts.

Rollback strategy:
- Keep runner path switchable between mocked and real execution contract-compatible payloads.
- Keep commentary/audio toggles independent from core state transitions.
- If instability appears, revert to the last phase-complete boundary while preserving persisted match data.

## Open Questions

- What exact tie-break precedence should be used when bids and deterministic tie seeds still collide (seed, manager ID, previous standings, or fixed order only)?
- What numeric cap should apply to incorrect submissions and what maximum bounded percentage should the LLM bonus contribute?
- Which persistence backend is the default for demo deployment (`SQLite` file path policy versus managed `Postgres`)?
- What artifact retention window is acceptable for run logs and replay payloads during demo operations?
- What default heartbeat interval best balances commentary freshness and token/runtime cost?
