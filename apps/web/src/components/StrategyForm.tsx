import { useState, useCallback } from 'react';
import { LoadingDots } from './ui/LoadingDots';

interface StrategyFormProps {
  matchId: string;
  managerId: string;
  round: number;
  onSubmit: (prompt: string) => Promise<void>;
  disabled?: boolean;
}

export function StrategyForm({
  round,
  onSubmit,
  disabled = false,
}: StrategyFormProps) {
  const [prompt, setPrompt] = useState('');
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = useCallback(async () => {
    if (disabled || submitted || loading) return;

    const text = prompt.trim();
    if (!text) {
      setError('write some instructions for your agent');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      await onSubmit(text);
      setSubmitted(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'failed to submit strategy');
    } finally {
      setLoading(false);
    }
  }, [prompt, disabled, submitted, loading, onSubmit]);

  if (submitted) {
    return (
      <div style={{ padding: '0.75rem' }}>
        <p style={{ color: 'var(--accent-green)', fontSize: '0.8125rem' }}>
          strategy submitted for round {round}
        </p>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.75rem', marginTop: '4px' }}>
          your agent is receiving instructions...
        </p>
      </div>
    );
  }

  return (
    <div style={{ padding: '0.75rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
      <label
        htmlFor="strategy-prompt"
        style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 200 }}
      >
        agent instructions (round {round})
      </label>
      <textarea
        id="strategy-prompt"
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
        disabled={disabled || loading}
        className="glass-input"
        placeholder="Write instructions for your agent..."
        rows={3}
        style={{ resize: 'vertical', fontFamily: 'inherit' }}
      />

      {error && (
        <p style={{ color: 'var(--accent-pink)', fontSize: '0.75rem' }}>{error}</p>
      )}

      <button
        onClick={handleSubmit}
        disabled={disabled || loading}
        className="glass-button primary"
        style={{ alignSelf: 'flex-start' }}
      >
        {loading ? <LoadingDots /> : 'submit strategy'}
      </button>
    </div>
  );
}
