import { useState, useCallback } from 'react';
import { LoadingDots } from './ui/LoadingDots';

interface BidFormProps {
  matchId: string;
  managerId: string;
  round: number;
  minBid?: number;
  maxBid?: number;
  onSubmit: (amount: number) => Promise<void>;
  disabled?: boolean;
}

export function BidForm({
  round,
  minBid = 0,
  maxBid = 1000,
  onSubmit,
  disabled = false,
}: BidFormProps) {
  const [amount, setAmount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = useCallback(async () => {
    if (disabled || submitted || loading) return;

    if (!Number.isInteger(amount)) {
      setError('bid must be a whole number');
      return;
    }
    if (amount < minBid) {
      setError(`bid must be at least ${minBid}`);
      return;
    }
    if (amount > maxBid) {
      setError(`bid must be at most ${maxBid}`);
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
  }, [amount, disabled, submitted, loading, minBid, maxBid, onSubmit]);

  if (submitted) {
    return (
      <div style={{ padding: '0.75rem' }}>
        <p style={{ color: 'var(--accent-green)', fontSize: '0.8125rem' }}>
          bid of <strong>{amount}</strong> submitted for round {round}
        </p>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.75rem', marginTop: '4px' }}>
          waiting for other managers...
        </p>
      </div>
    );
  }

  return (
    <div style={{ padding: '0.75rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
      <label
        htmlFor="bid-amount"
        style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 200 }}
      >
        your bid (round {round})
      </label>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
        <input
          id="bid-amount"
          type="number"
          min={minBid}
          max={maxBid}
          value={amount}
          onChange={(e) => setAmount(parseInt(e.target.value, 10) || 0)}
          disabled={disabled || loading}
          className="glass-input"
          style={{ width: '120px' }}
        />
        <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>
          ({minBid}-{maxBid})
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
