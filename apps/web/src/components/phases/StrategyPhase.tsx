import { GlassCard } from '../ui/GlassCard';

interface StrategyPhaseProps {
  round: number;
  bidWinner?: { managerId: string; managerName: string; amount: number } | null;
}

export function StrategyPhase({ round, bidWinner }: StrategyPhaseProps) {
  return (
    <GlassCard>
      <div style={{ padding: '1rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '0.75rem' }}>
          <span className="pill orange">round {round}</span>
          <span className="pill orange">strategy</span>
        </div>
        {bidWinner && (
          <div style={{ marginBottom: '0.75rem', padding: '0.5rem 0.75rem', borderLeft: '2px solid var(--accent-green)' }}>
            <span style={{ fontSize: '0.8125rem', color: 'var(--accent-green)' }}>
              {bidWinner.managerName} won the data card for {bidWinner.amount} pts
            </span>
          </div>
        )}
        {!bidWinner && (
          <div style={{ marginBottom: '0.75rem', padding: '0.5rem 0.75rem', borderLeft: '2px solid var(--text-muted)' }}>
            <span style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
              no one bid — data card unclaimed
            </span>
          </div>
        )}
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.8125rem' }}>
          write instructions for your agent. every word shapes the code to come.
        </p>
      </div>
    </GlassCard>
  );
}
