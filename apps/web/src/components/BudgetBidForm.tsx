import { useState, useCallback } from 'react';
import { LoadingDots } from './ui/LoadingDots';

interface BudgetBidFormProps {
  matchId: string;
  managerId: string;
  round: number;
  remainingBudget: number;
  onSubmit: (amount: number) => Promise<void>;
  disabled?: boolean;
}

export function BudgetBidForm({
  round,
  remainingBudget,
  onSubmit,
  disabled = false,
}: BudgetBidFormProps) {
  const [raw, setRaw] = useState('');
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const parsedAmount = raw === '' ? 0 : parseInt(raw, 10);

  const handleSubmit = useCallback(async () => {
    if (disabled || submitted || loading) return;

    const amount = raw === '' ? 0 : parseInt(raw, 10);
    if (isNaN(amount) || !Number.isInteger(amount)) {
      setError('bid must be a whole number');
      return;
    }
    if (amount < 0) {
      setError('bid must be non-negative');
      return;
    }
    if (amount > remainingBudget) {
      setError(`bid exceeds budget (${remainingBudget})`);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      await onSubmit(amount);
      setSubmitted(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'failed to submit bid');
    } finally {
      setLoading(false);
    }
  }, [raw, disabled, submitted, loading, remainingBudget, onSubmit]);

  if (submitted) {
    return (
      <div style={{ padding: '0.75rem' }}>
        <p style={{ color: 'var(--accent-green)', fontSize: '0.8125rem' }}>
          bid of <strong>{parsedAmount}</strong> submitted for round {round}
        </p>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.75rem', marginTop: '4px' }}>
          waiting for other champions...
        </p>
      </div>
    );
  }

  return (
    <div style={{ padding: '0.75rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <label
          htmlFor="bid-amount"
          style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 200 }}
        >
          your bid (round {round})
        </label>
        <span style={{ fontSize: '0.75rem', color: 'var(--accent-purple, #a78bfa)' }}>
          budget: {remainingBudget}
        </span>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
        <input
          id="bid-amount"
          type="text"
          inputMode="numeric"
          min={0}
          max={remainingBudget}
          value={raw}
          placeholder="0"
          onChange={(e) => setRaw(e.target.value.replace(/[^0-9]/g, ''))}
          disabled={disabled || loading}
          className="glass-input"
          style={{ width: '120px' }}
        />
        <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>
          (0-{remainingBudget})
        </span>
      </div>

      {error && (
        <p style={{ color: 'var(--accent-pink)', fontSize: '0.75rem' }}>{error}</p>
      )}

      <button
        onClick={handleSubmit}
        disabled={disabled || loading}
        className="glass-button primary"
        style={{ alignSelf: 'flex-start' }}
      >
        {loading ? <LoadingDots /> : 'submit bid'}
      </button>
    </div>
  );
}
