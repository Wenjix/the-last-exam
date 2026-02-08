import { GlassCard } from '../ui/GlassCard';

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
    <GlassCard>
      <div style={{ padding: '1rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '0.75rem' }}>
          <span className="pill orange">round {round}</span>
          <span className="pill orange">results</span>
        </div>
        {scores ? (
          <table className="glass-table">
            <thead>
              <tr>
                <th>manager</th>
                <th>score</th>
                <th>correctness</th>
                <th>total</th>
              </tr>
            </thead>
            <tbody>
              {scores.map((s) => (
                <tr key={s.managerId}>
                  <td>{s.managerName}</td>
                  <td style={{ color: 'var(--accent-orange)' }}>{s.score.toFixed(1)}</td>
                  <td>{(s.correctness * 100).toFixed(0)}%</td>
                  <td style={{ color: 'var(--accent-pink)' }}>
                    {standings?.[s.managerId]?.toFixed(1) ?? '-'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.8125rem' }}>calculating scores...</p>
        )}
      </div>
    </GlassCard>
  );
}
