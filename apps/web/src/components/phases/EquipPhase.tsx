interface EquipPhaseProps {
  round: number;
  availableTools?: string[];
  onSubmitEquip?: (tools: string[], hazards: string[]) => void;
  remainingMs?: number;
  submitted?: boolean;
}

export function EquipPhase({ round, availableTools, onSubmitEquip, remainingMs, submitted }: EquipPhaseProps) {
  return (
    <div style={{ padding: '1rem' }}>
      <h2>Round {round} - Equip</h2>
      {remainingMs !== undefined && <p>Time remaining: {Math.ceil(remainingMs / 1000)}s</p>}
      {submitted ? (
        <p>Equipment selections submitted. Preparing for run...</p>
      ) : (
        <div>
          <p>Select tools and assign hazards for this round.</p>
          {availableTools && availableTools.length > 0 ? (
            <div>
              <h4>Available Tools:</h4>
              <ul>
                {availableTools.map((tool) => (
                  <li key={tool}>{tool}</li>
                ))}
              </ul>
            </div>
          ) : (
            <p>No tools available.</p>
          )}
          <button onClick={() => onSubmitEquip?.([], [])}>Submit Equipment</button>
        </div>
      )}
    </div>
  );
}
