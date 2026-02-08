import { GlassCard } from '../ui/GlassCard';

interface EquipPhaseProps {
  round: number;
  availableTools?: string[];
  onSubmitEquip?: (tools: string[], hazards: string[]) => void;
  remainingMs?: number;
  submitted?: boolean;
}

export function EquipPhase({ round, remainingMs, submitted }: EquipPhaseProps) {
  return (
    <GlassCard>
      <div style={{ padding: '1rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '0.75rem' }}>
          <span className="pill orange">round {round}</span>
          <span className="pill orange">equip</span>
          {remainingMs !== undefined && (
            <span className="pill" style={{ color: 'var(--text-secondary)' }}>
              {Math.ceil(remainingMs / 1000)}s
            </span>
          )}
        </div>
        {submitted ? (
          <p style={{ color: 'var(--accent-green)', fontSize: '0.8125rem' }}>
            equipment selections submitted. preparing for run...
          </p>
        ) : (
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.8125rem' }}>
            select tools and assign hazards in your manager card.
          </p>
        )}
      </div>
    </GlassCard>
  );
}
