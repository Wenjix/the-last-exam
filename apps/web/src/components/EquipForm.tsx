import { useState, useCallback } from 'react';
import { LoadingDots } from './ui/LoadingDots';

interface EquipFormProps {
  matchId: string;
  managerId: string;
  round: number;
  availableTools: Array<{ id: string; name: string; description: string }>;
  availableHazards: Array<{ id: string; name: string; description: string }>;
  maxTools?: number;
  onSubmit: (toolIds: string[], hazardIds: string[]) => Promise<void>;
  disabled?: boolean;
}

export function EquipForm({
  round,
  availableTools,
  availableHazards,
  maxTools = 3,
  onSubmit,
  disabled = false,
}: EquipFormProps) {
  const [selectedTools, setSelectedTools] = useState<Set<string>>(new Set());
  const [selectedHazards, setSelectedHazards] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const toggleTool = useCallback((toolId: string) => {
    setSelectedTools((prev) => {
      const next = new Set(prev);
      if (next.has(toolId)) {
        next.delete(toolId);
      } else if (next.size < maxTools) {
        next.add(toolId);
      }
      return next;
    });
  }, [maxTools]);

  const toggleHazard = useCallback((hazardId: string) => {
    setSelectedHazards((prev) => {
      const next = new Set(prev);
      if (next.has(hazardId)) {
        next.delete(hazardId);
      } else {
        next.add(hazardId);
      }
      return next;
    });
  }, []);

  const handleSubmit = useCallback(async () => {
    if (disabled || submitted || loading) return;
    setLoading(true);
    setError(null);

    try {
      await onSubmit([...selectedTools], [...selectedHazards]);
      setSubmitted(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'failed to submit equipment');
    } finally {
      setLoading(false);
    }
  }, [disabled, submitted, loading, selectedTools, selectedHazards, onSubmit]);

  if (submitted) {
    return (
      <div style={{ padding: '0.75rem' }}>
        <p style={{ color: 'var(--accent-green)', fontSize: '0.8125rem' }}>
          equipment submitted for round {round}
        </p>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.75rem', marginTop: '4px' }}>
          tools: {selectedTools.size > 0 ? [...selectedTools].join(', ') : 'none'} |
          hazards: {selectedHazards.size > 0 ? [...selectedHazards].join(', ') : 'none'}
        </p>
      </div>
    );
  }

  return (
    <div style={{ padding: '0.75rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
      <div>
        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 200, marginBottom: '0.5rem' }}>
          select tools (max {maxTools}) — round {round}
        </div>
        {availableTools.length > 0 ? (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.375rem' }}>
            {availableTools.map((tool) => (
              <button
                key={tool.id}
                onClick={() => toggleTool(tool.id)}
                disabled={disabled || loading}
                className={`glass-button ${selectedTools.has(tool.id) ? 'primary' : ''}`}
                style={{ fontSize: '0.75rem', padding: '0.375rem 0.75rem' }}
                title={tool.description}
              >
                {tool.name}
              </button>
            ))}
          </div>
        ) : (
          <p style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>no tools available</p>
        )}
      </div>

      <div>
        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 200, marginBottom: '0.5rem' }}>
          assign hazards
        </div>
        {availableHazards.length > 0 ? (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.375rem' }}>
            {availableHazards.map((hazard) => (
              <button
                key={hazard.id}
                onClick={() => toggleHazard(hazard.id)}
                disabled={disabled || loading}
                className={`glass-button ${selectedHazards.has(hazard.id) ? 'primary' : ''}`}
                style={{ fontSize: '0.75rem', padding: '0.375rem 0.75rem' }}
                title={hazard.description}
              >
                {hazard.name}
              </button>
            ))}
          </div>
        ) : (
          <p style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>no hazards this round</p>
        )}
      </div>

      {error && <p style={{ color: 'var(--accent-pink)', fontSize: '0.75rem' }}>{error}</p>}

      <button
        onClick={handleSubmit}
        disabled={disabled || loading}
        className="glass-button primary"
        style={{ alignSelf: 'flex-start' }}
      >
        {loading ? <LoadingDots /> : 'submit equipment'}
      </button>
    </div>
  );
}
