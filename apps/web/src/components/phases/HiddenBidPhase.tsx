import { GlassCard } from '../ui/GlassCard';

interface HiddenBidPhaseProps {
  round: number;
  onSubmitBid?: (amount: number) => void;
  remainingMs?: number;
  submitted?: boolean;
}

export function HiddenBidPhase({ round, remainingMs, submitted }: HiddenBidPhaseProps) {
  return (
    <GlassCard>
      <div style={{ padding: '1rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '0.75rem' }}>
          <span className="pill pink">round {round}</span>
          <span className="pill pink">hidden bid</span>
          {remainingMs !== undefined && (
            <span className="pill" style={{ color: 'var(--text-secondary)' }}>
              {Math.ceil(remainingMs / 1000)}s
            </span>
          )}
        </div>
        {submitted ? (
          <p style={{ color: 'var(--accent-green)', fontSize: '0.8125rem' }}>
            bid submitted. waiting for other managers...
          </p>
        ) : (
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.8125rem' }}>
            place your bid in your manager card.
          </p>
        )}
      </div>
    </GlassCard>
  );
}
