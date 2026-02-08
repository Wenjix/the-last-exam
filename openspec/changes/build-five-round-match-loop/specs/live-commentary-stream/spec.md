## ADDED Requirements

### Requirement: Event-triggered commentary updates
The system SHALL generate commentary updates from match lifecycle and run-result events and MUST publish updates in round context.

#### Scenario: Round event triggers commentary
- **WHEN** a significant round event occurs, such as phase start or result resolution
- **THEN** the commentary pipeline emits a text update associated with the current round and phase

### Requirement: Heartbeat summaries during run phase
The system SHALL emit periodic heartbeat commentary during run execution windows to maintain continuous spectator context.

#### Scenario: Run phase remains active without major events
- **WHEN** run phase is active and no event-triggered commentary has fired within the heartbeat interval
- **THEN** the system emits a heartbeat summary update

### Requirement: Rate-limited commentary output
The system SHALL enforce rate limits on commentary emission to prevent client flooding and unstable rendering behavior.

#### Scenario: Commentary queue receives burst events
- **WHEN** many commentary-triggering events arrive in a short interval
- **THEN** the system applies rate limiting and emits updates within configured throughput bounds

### Requirement: Commentary is non-blocking to gameplay
The system MUST keep phase transitions and scoring independent from commentary generation outcomes.

#### Scenario: Commentary provider times out
- **WHEN** commentary generation fails or exceeds timeout
- **THEN** the server continues phase progression and scoring without waiting for commentary completion

### Requirement: Text fallback for presentation
The system SHALL provide text commentary payloads that can be rendered even when audio playback is disabled or unavailable.

#### Scenario: Audio is disabled on client
- **WHEN** a client has audio muted or cannot play generated audio
- **THEN** commentary text updates remain available and visible for the same events
