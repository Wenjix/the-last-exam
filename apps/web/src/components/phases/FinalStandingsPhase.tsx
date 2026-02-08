interface Standing {
  managerId: string;
  managerName: string;
  totalScore: number;
  rank: number;
}

interface FinalStandingsPhaseProps {
  standings?: Standing[];
}

export function FinalStandingsPhase({ standings }: FinalStandingsPhaseProps) {
  return (
    <div style={{ padding: '1rem' }}>
      <h2>Final Standings</h2>
      {standings ? (
        <table style={{ borderCollapse: 'collapse', width: '100%' }}>
          <thead>
            <tr>
              <th style={{ border: '1px solid #ccc', padding: '0.5rem' }}>Rank</th>
              <th style={{ border: '1px solid #ccc', padding: '0.5rem' }}>Manager</th>
              <th style={{ border: '1px solid #ccc', padding: '0.5rem' }}>Total Score</th>
            </tr>
          </thead>
          <tbody>
            {standings.sort((a, b) => a.rank - b.rank).map((s) => (
              <tr key={s.managerId}>
                <td style={{ border: '1px solid #ccc', padding: '0.5rem' }}>#{s.rank}</td>
                <td style={{ border: '1px solid #ccc', padding: '0.5rem' }}>{s.managerName}</td>
                <td style={{ border: '1px solid #ccc', padding: '0.5rem' }}>{s.totalScore.toFixed(1)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <p>Calculating final standings...</p>
      )}
    </div>
  );
}
