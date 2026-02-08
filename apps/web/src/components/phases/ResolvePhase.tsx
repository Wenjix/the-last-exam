interface RoundScore {
  managerId: string;
  managerName: string;
  score: number;
  correctness: number;
}

interface ResolvePhaseProps {
  round: number;
  scores?: RoundScore[];
  standings?: Record<string, number>;
}

export function ResolvePhase({ round, scores, standings }: ResolvePhaseProps) {
  return (
    <div style={{ padding: '1rem' }}>
      <h2>Round {round} - Results</h2>
      {scores ? (
        <table style={{ borderCollapse: 'collapse', width: '100%' }}>
          <thead>
            <tr>
              <th style={{ border: '1px solid #ccc', padding: '0.5rem' }}>Manager</th>
              <th style={{ border: '1px solid #ccc', padding: '0.5rem' }}>Score</th>
              <th style={{ border: '1px solid #ccc', padding: '0.5rem' }}>Correctness</th>
              <th style={{ border: '1px solid #ccc', padding: '0.5rem' }}>Total</th>
            </tr>
          </thead>
          <tbody>
            {scores.map((s) => (
              <tr key={s.managerId}>
                <td style={{ border: '1px solid #ccc', padding: '0.5rem' }}>{s.managerName}</td>
                <td style={{ border: '1px solid #ccc', padding: '0.5rem' }}>{s.score.toFixed(1)}</td>
                <td style={{ border: '1px solid #ccc', padding: '0.5rem' }}>{(s.correctness * 100).toFixed(0)}%</td>
                <td style={{ border: '1px solid #ccc', padding: '0.5rem' }}>{standings?.[s.managerId]?.toFixed(1) ?? '-'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <p>Calculating scores...</p>
      )}
    </div>
  );
}
