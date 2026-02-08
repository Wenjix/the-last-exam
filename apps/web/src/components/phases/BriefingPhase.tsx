import { GlassCard } from '../ui/GlassCard';

interface BriefingPhaseProps {
  round: number;
  challengeTitle?: string;
  challengeDescription?: string;
  dataCardTitle?: string;
  dataCardDescription?: string;
}

export function BriefingPhase({ round, challengeTitle, challengeDescription, dataCardTitle, dataCardDescription }: BriefingPhaseProps) {
  return (
    <GlassCard>
      <div style={{ padding: '1rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '0.75rem' }}>
          <span className="pill cyan">round {round}</span>
          <span className="pill cyan">briefing</span>
        </div>
        <h3 style={{ fontSize: '1rem', fontWeight: 400, color: 'var(--text-primary)', marginBottom: '0.5rem' }}>
          {challengeTitle || 'loading challenge...'}
        </h3>
        <p style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
          {challengeDescription || 'challenge details will appear here.'}
        </p>
        {dataCardTitle && (
          <div style={{ marginTop: '0.75rem', padding: '0.5rem 0.75rem', borderLeft: '2px solid var(--accent-purple, #a78bfa)' }}>
            <div style={{ fontSize: '0.75rem', color: 'var(--accent-purple, #a78bfa)', fontWeight: 200, marginBottom: '4px' }}>
              data card: {dataCardTitle}
            </div>
            <p style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', lineHeight: 1.6, margin: 0 }}>
              {dataCardDescription}
            </p>
          </div>
        )}
      </div>
    </GlassCard>
  );
}
