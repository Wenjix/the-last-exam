import { GlassCard } from '../ui/GlassCard';

interface BriefingPhaseProps {
  round: number;
  challengeTitle?: string;
  challengeDescription?: string;
  hazardName?: string;
  hazardDescription?: string;
}

export function BriefingPhase({ round, challengeTitle, challengeDescription, hazardName, hazardDescription }: BriefingPhaseProps) {
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
        {hazardName && (
          <div style={{ marginTop: '0.75rem', padding: '0.5rem 0.75rem', borderLeft: '2px solid var(--accent-pink)' }}>
            <div style={{ fontSize: '0.75rem', color: 'var(--accent-pink)', fontWeight: 200, marginBottom: '4px' }}>
              hazard: {hazardName}
            </div>
            <p style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', lineHeight: 1.6, margin: 0 }}>
              {hazardDescription}
            </p>
          </div>
        )}
      </div>
    </GlassCard>
  );
}
