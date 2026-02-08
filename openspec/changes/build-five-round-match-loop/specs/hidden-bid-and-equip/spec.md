## ADDED Requirements

### Requirement: Secret bid submission
The system SHALL accept hidden bids per round for all managers and MUST keep bid values concealed from other managers until bid resolution.

#### Scenario: Hidden bids are collected
- **WHEN** managers submit bids during the hidden bid phase
- **THEN** the server stores each bid privately and does not expose bid values in public round state before resolution

### Requirement: Deterministic bid resolution
The system SHALL resolve tool-card bidding deterministically and MUST apply stable tie-break precedence for equal bids.

#### Scenario: Two managers submit equal bids
- **WHEN** bid resolution runs for a tool card with tied highest bids
- **THEN** the server applies deterministic tie-break logic and records a single reproducible winner in the round events

### Requirement: Equip validation against owned tools
The system SHALL validate equip submissions against the manager's resolved tool ownership and MUST reject invalid equips with machine-readable reasons.

#### Scenario: Manager equips an unavailable tool
- **WHEN** a manager submits an equip payload containing a tool not owned after bid resolution
- **THEN** the server rejects the submission and returns a validation error that identifies the invalid tool

### Requirement: Deterministic bot bid and equip policy
The system SHALL execute bot bidding and equip decisions from deterministic policy inputs and MUST produce the same bot actions for the same seed and game state.

#### Scenario: Replay runs bot decisions from the same seed
- **WHEN** the same round state and seed are provided to bot policy evaluation
- **THEN** the resulting bot bid and equip actions are identical
