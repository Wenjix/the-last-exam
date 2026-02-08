import { GlassCard } from '../ui/GlassCard';

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
    <div
      style={{
        position: 'fixed',
        inset: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'rgba(0, 0, 0, 0.8)',
        backdropFilter: 'blur(20px)',
        zIndex: 20,
        animation: 'fade-in 0.5s ease',
      }}
    >
      <GlassCard expanded>
        <div style={{ padding: '2rem', minWidth: '400px', textAlign: 'center' }}>
          <h2 style={{
            fontSize: '1.5rem',
            fontWeight: 200,
            color: 'var(--accent-pink)',
            marginBottom: '1.5rem',
          }}>
            final standings
          </h2>
          {standings ? (
            <table className="glass-table" style={{ textAlign: 'left' }}>
              <thead>
                <tr>
                  <th>rank</th>
                  <th>manager</th>
                  <th>score</th>
                </tr>
              </thead>
              <tbody>
                {[...standings].sort((a, b) => a.rank - b.rank).map((s) => (
                  <tr key={s.managerId}>
                    <td style={{
                      color: s.rank === 1 ? 'var(--accent-pink)' : 'var(--text-secondary)',
                      fontWeight: s.rank === 1 ? 400 : 200,
                    }}>
                      #{s.rank}
                    </td>
                    <td style={{
                      color: s.rank === 1 ? 'var(--accent-pink)' : 'var(--text-primary)',
                    }}>
                      {s.managerName}
                    </td>
                    <td style={{ color: 'var(--accent-orange)' }}>{s.totalScore.toFixed(1)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.8125rem' }}>
              calculating final standings...
            </p>
          )}
        </div>
      </GlassCard>
    </div>
  );
}
