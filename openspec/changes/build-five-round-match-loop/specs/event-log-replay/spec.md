## ADDED Requirements

### Requirement: Durable ordered event log
The system SHALL persist authoritative match events with a stable total order and MUST retain enough metadata to reconstruct phase and round state.

#### Scenario: Match emits lifecycle events
- **WHEN** the server processes actions and phase transitions
- **THEN** each emitted event is persisted with a monotonically ordered sequence identifier

### Requirement: Persist run artifacts and score details
The system SHALL persist run artifacts and score breakdown records required to explain and replay round outcomes.

#### Scenario: Runner result is accepted
- **WHEN** a runner callback is processed for an agent
- **THEN** the system stores execution result metadata, harness outputs, and score component details for replay use

### Requirement: Replay reconstruction without regeneration
The system MUST reconstruct replay timelines from persisted events and artifacts only and MUST NOT regenerate code or rerun generation models during replay.

#### Scenario: User requests replay for a completed match
- **WHEN** replay data is requested
- **THEN** the server returns replay frames derived from stored events and artifacts without invoking generation or execution pipelines

### Requirement: Deterministic replay outcomes
The system SHALL reproduce final standings and round outcomes consistently for the same stored event/artifact set.

#### Scenario: Replay is requested multiple times
- **WHEN** replay reconstruction runs repeatedly for the same completed match
- **THEN** each replay produces identical standings and per-round outcome summaries

### Requirement: Replay API returns ordered stream
The system SHALL expose replay data through a contract that returns events in authoritative order for client-side timeline rendering.

#### Scenario: Client fetches replay timeline
- **WHEN** a client calls the replay endpoint for a match
- **THEN** the response contains an ordered sequence of replay events suitable for deterministic timeline playback
