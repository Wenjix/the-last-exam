# The Last Exam - Architecture Decisions (Frozen)

## Purpose

This document records the locked architecture and product decisions for MVP implementation.

## Decisions

1. Game mode: single-player MVP (`1 human manager + 3 bot managers`).
2. Match format: `5 rounds`.
3. Round timing: full round target `2-2.5 minutes`.
4. Phase timing baseline:
   - `Briefing: 10s`
   - `Hidden Bid: 30s`
   - `Bid Resolve: 5s`
   - `Equip: 30s`
   - `Run: up to 60s`
   - `Resolve: 15s`
5. Scoring authority: `harness-first deterministic scoring`.
6. Correctness gate: incorrect/failed solutions are capped heavily or zeroed on objective.
7. LLM judge council: optional bounded bonus only (style/readability), cannot override correctness.
8. Determinism policy:
   - Deterministic game state/rules/tie-breakers/bot policies.
   - Nondeterministic generation is allowed at runtime.
   - Replay uses persisted artifacts/results and never re-generates.
9. Hazards: modifiers only; no phase/rule rewrites.
10. Tools: creative but implementable, including data-file/context/tool-access style cards.
11. Traits: visible in MVP (concept showcase), flavor-only initially.
12. Human agency in MVP: bid + equip only.
13. Bot sophistication: basic deterministic heuristics.
14. Commentary: continuous-feel, event-triggered + rate-limited streaming (heartbeat summaries).
15. Execution sandbox: local-first isolated runs with strict resource/network limits; E2B adapter optional later.
16. Persistence: in-memory active state + minimal durable event/artifact storage (SQLite or Postgres).
17. No on-chain/wallet/voting systems.
18. Scope content for v1:
   - `5` HLCE/HLE-derived executable challenges
   - `5` hazards
   - `8` tools
19. Naming:
   - Product name: `The Last Exam`
   - Internal namespace prefix: `tle`
20. Priority target: playable hackathon demo.

## Non-Negotiables

1. Keep server-authoritative game state.
2. Keep deterministic core rules in shared game-core.
3. Keep one audio provider only for MVP (Gemini).
4. Keep replay based on stored events/artifacts, not reruns.
5. Keep legacy branding out of new implementation.

