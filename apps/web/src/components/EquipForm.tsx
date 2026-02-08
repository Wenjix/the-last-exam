import { useState, useCallback } from 'react';

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
      setError(err instanceof Error ? err.message : 'Failed to submit equipment');
    } finally {
      setLoading(false);
    }
  }, [disabled, submitted, loading, selectedTools, selectedHazards, onSubmit]);

  if (submitted) {
    return (
      <div style={{ padding: '1rem', backgroundColor: '#e8f5e9', borderRadius: '4px' }}>
        <p>Equipment submitted for Round {round}.</p>
        <p style={{ color: '#666', fontSize: '0.875rem' }}>
          Tools: {selectedTools.size > 0 ? [...selectedTools].join(', ') : 'None'} |
          Hazards: {selectedHazards.size > 0 ? [...selectedHazards].join(', ') : 'None'}
        </p>
      </div>
    );
  }

  return (
    <div style={{ padding: '1rem' }}>
      <h4>Select Tools (max {maxTools}) - Round {round}</h4>
      {availableTools.length > 0 ? (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '1rem' }}>
          {availableTools.map((tool) => (
            <button
              key={tool.id}
              onClick={() => toggleTool(tool.id)}
              disabled={disabled || loading}
              style={{
                padding: '0.5rem 1rem',
                border: selectedTools.has(tool.id) ? '2px solid #1976d2' : '1px solid #ccc',
                borderRadius: '4px',
                backgroundColor: selectedTools.has(tool.id) ? '#e3f2fd' : 'white',
                cursor: disabled || loading ? 'not-allowed' : 'pointer',
              }}
              title={tool.description}
            >
              {tool.name}
            </button>
          ))}
        </div>
      ) : (
        <p style={{ color: '#666' }}>No tools available this round.</p>
      )}

      <h4>Assign Hazards</h4>
      {availableHazards.length > 0 ? (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '1rem' }}>
          {availableHazards.map((hazard) => (
            <button
              key={hazard.id}
              onClick={() => toggleHazard(hazard.id)}
              disabled={disabled || loading}
              style={{
                padding: '0.5rem 1rem',
                border: selectedHazards.has(hazard.id) ? '2px solid #c00' : '1px solid #ccc',
                borderRadius: '4px',
                backgroundColor: selectedHazards.has(hazard.id) ? '#ffebee' : 'white',
                cursor: disabled || loading ? 'not-allowed' : 'pointer',
              }}
              title={hazard.description}
            >
              {hazard.name}
            </button>
          ))}
        </div>
      ) : (
        <p style={{ color: '#666' }}>No hazards this round.</p>
      )}

      {error && <p style={{ color: '#c00', fontSize: '0.875rem' }}>{error}</p>}

      <button
        onClick={handleSubmit}
        disabled={disabled || loading}
        style={{
          padding: '0.5rem 1.5rem',
          fontSize: '1rem',
          backgroundColor: loading ? '#ccc' : '#1976d2',
          color: 'white',
          border: 'none',
          borderRadius: '4px',
          cursor: disabled || loading ? 'not-allowed' : 'pointer',
        }}
      >
        {loading ? 'Submitting...' : 'Submit Equipment'}
      </button>
    </div>
  );
}
