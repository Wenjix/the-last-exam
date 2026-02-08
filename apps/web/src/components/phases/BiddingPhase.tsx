import { GlassCard } from '../ui/GlassCard';

interface BiddingPhaseProps {
  round: number;
  dataCardTitle?: string;
  dataCardDescription?: string;
  budgets?: Record<string, number>;
}

export function BiddingPhase({ round, dataCardTitle, dataCardDescription, budgets }: BiddingPhaseProps) {
  return (
    <GlassCard>
      <div style={{ padding: '1rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '0.75rem' }}>
          <span className="pill pink">round {round}</span>
          <span className="pill pink">bidding</span>
        </div>
        {dataCardTitle && (
          <div style={{ marginBottom: '0.75rem', padding: '0.5rem 0.75rem', borderLeft: '2px solid var(--accent-purple, #a78bfa)' }}>
            <div style={{ fontSize: '0.75rem', color: 'var(--accent-purple, #a78bfa)', fontWeight: 200, marginBottom: '4px' }}>
              data card: {dataCardTitle}
            </div>
            <p style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', lineHeight: 1.6, margin: 0 }}>
              {dataCardDescription}
            </p>
          </div>
        )}
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.8125rem' }}>
          bid from your budget to win this round's data card. highest bidder gets the hint.
        </p>
        {budgets && Object.keys(budgets).length > 0 && (
          <div style={{ marginTop: '0.5rem', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
            budgets visible to all champions
          </div>
        )}
      </div>
    </GlassCard>
  );
}
