import { GlassCard } from '../ui/GlassCard';
import { LoadingDots } from '../ui/LoadingDots';

interface RunPhaseProps {
  round: number;
  remainingMs?: number;
  agentStatuses?: Array<{ agentId: string; name: string; status: string }>;
}

export function RunPhase({ round, remainingMs, agentStatuses }: RunPhaseProps) {
  return (
    <GlassCard>
      <div style={{ padding: '1rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '0.75rem' }}>
          <span className="pill green">round {round}</span>
          <span className="pill green">execution</span>
          {remainingMs !== undefined && (
            <span className="pill" style={{ color: 'var(--text-secondary)' }}>
              {Math.ceil(remainingMs / 1000)}s
            </span>
          )}
          <LoadingDots />
        </div>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.8125rem', marginBottom: '0.5rem' }}>
          all four agents are solving the challenge simultaneously...
        </p>
        {agentStatuses && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            {agentStatuses.map((a) => (
              <div key={a.agentId} style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                <span style={{ color: 'var(--accent-green)' }}>{a.name}</span>: {a.status}
              </div>
            ))}
          </div>
        )}
      </div>
    </GlassCard>
  );
}
