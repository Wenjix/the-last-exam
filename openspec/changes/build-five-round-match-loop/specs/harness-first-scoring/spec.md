## ADDED Requirements

### Requirement: Harness correctness is scoring authority
The system SHALL calculate objective run outcomes from executable harness results and MUST use those outcomes as the primary authority for scoring.

#### Scenario: Harness result is available for a run
- **WHEN** the runner returns harness execution output for an agent submission
- **THEN** the scoring pipeline derives objective score components directly from harness correctness and measured performance signals

### Requirement: Correctness gating on failures
The system SHALL heavily cap or zero objective score for incorrect, timed-out, or failed executions and MUST not score such runs as fully correct.

#### Scenario: Submission fails harness checks
- **WHEN** a submission returns failed tests or runtime failure status
- **THEN** the system applies correctness gating that caps or zeros objective score for that run

### Requirement: Bounded judge bonus
The system SHALL support an optional bounded LLM judge bonus for style/readability and MUST enforce a configured upper bound for that bonus.

#### Scenario: Judge bonus is enabled
- **WHEN** judge scoring is executed for a valid run
- **THEN** the bonus contribution is clamped to the configured limit before final score aggregation

### Requirement: Judge bonus cannot override correctness authority
The system MUST prevent judge bonus from reversing correctness-first outcomes where an incorrect run would otherwise outrank a correct run on objective scoring.

#### Scenario: Incorrect run receives high style score
- **WHEN** an incorrect run receives a high style/readability assessment
- **THEN** final ranking logic keeps the correct run ahead due to correctness-first scoring rules

### Requirement: Auditable score breakdown
The system SHALL produce a structured score breakdown per run with objective and bonus components for replay and diagnostics.

#### Scenario: Round scoring is finalized
- **WHEN** scores are committed at resolve phase
- **THEN** the persisted run record includes objective component values, bonus component values, and final total
