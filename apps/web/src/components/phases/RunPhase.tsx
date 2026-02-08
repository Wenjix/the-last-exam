interface RunPhaseProps {
  round: number;
  remainingMs?: number;
  agentStatuses?: Array<{ agentId: string; name: string; status: string }>;
}

export function RunPhase({ round, remainingMs, agentStatuses }: RunPhaseProps) {
  return (
    <div style={{ padding: '1rem' }}>
      <h2>Round {round} - Run</h2>
      {remainingMs !== undefined && <p>Time remaining: {Math.ceil(remainingMs / 1000)}s</p>}
      <p>Agents are working on the challenge...</p>
      {agentStatuses && (
        <ul>
          {agentStatuses.map((a) => (
            <li key={a.agentId}>{a.name}: {a.status}</li>
          ))}
        </ul>
      )}
    </div>
  );
}
