import { GlassCard } from '../ui/GlassCard';

interface ScoringPhaseProps {
  round: number;
  standings: Record<string, number>;
  managers: { id: string; name: string }[];
}

export function ScoringPhase({ round, standings, managers }: ScoringPhaseProps) {
  const sorted = Object.entries(standings)
    .sort(([, a], [, b]) => b - a);

  const nameMap = new Map(managers.map((m) => [m.id, m.name]));

  return (
    <GlassCard>
      <div style={{ padding: '1rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '0.75rem' }}>
          <span className="pill orange">round {round}</span>
          <span className="pill orange">scoring</span>
        </div>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.8125rem', marginBottom: '0.5rem' }}>
          round {round} results
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          {sorted.map(([id, score], i) => (
            <div key={id} style={{ fontSize: '0.8125rem', color: i === 0 ? 'var(--accent-green)' : 'var(--text-secondary)' }}>
              #{i + 1} {nameMap.get(id) ?? id} — {score.toFixed(0)} pts
            </div>
          ))}
        </div>
      </div>
    </GlassCard>
  );
}
