## ADDED Requirements

### Requirement: Server-authoritative match initialization
The system SHALL create matches under server authority with exactly one human manager and three bot managers, and MUST initialize exactly five rounds for the match.

#### Scenario: Match is created for the MVP mode
- **WHEN** a client requests a new match for the single-player mode
- **THEN** the server creates a match state with one human manager, three bot managers, and round count set to five

### Requirement: Fixed round phase sequence
The system SHALL execute each round in this order: briefing, hidden bid, bid resolve, equip, run, resolve, and MUST NOT skip or reorder phases during normal progression.

#### Scenario: Server advances through a round
- **WHEN** the server processes phase transitions for an active round
- **THEN** phase transition events are emitted in the fixed sequence briefing -> hidden bid -> bid resolve -> equip -> run -> resolve

### Requirement: Server-issued phase deadlines
The system SHALL publish server-issued absolute deadlines for each phase and MUST enforce phase closure based on server time.

#### Scenario: Client displays countdown for a phase
- **WHEN** the client receives phase state and deadline from the server
- **THEN** the client computes countdown from the server deadline and the server closes the phase at its own deadline regardless of client timer state

### Requirement: Deterministic match completion
The system SHALL finalize standings after round five resolve using deterministic tie-break rules and MUST emit a final match-complete event.

#### Scenario: Final round resolves
- **WHEN** round five resolve phase completes
- **THEN** the server computes final standings with deterministic tie-breakers and emits a match-complete event containing final ordering
