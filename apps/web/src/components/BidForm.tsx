import { useState, useCallback } from 'react';

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

    // Client-side validation
    if (!Number.isInteger(amount)) {
      setError('Bid must be a whole number');
      return;
    }
    if (amount < minBid) {
      setError(`Bid must be at least ${minBid}`);
      return;
    }
    if (amount > maxBid) {
      setError(`Bid must be at most ${maxBid}`);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      await onSubmit(amount);
      setSubmitted(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to submit bid');
    } finally {
      setLoading(false);
    }
  }, [amount, disabled, submitted, loading, minBid, maxBid, onSubmit]);

  if (submitted) {
    return (
      <div style={{ padding: '1rem', backgroundColor: '#e8f5e9', borderRadius: '4px' }}>
        <p>Bid of <strong>{amount}</strong> submitted for Round {round}.</p>
        <p style={{ color: '#666', fontSize: '0.875rem' }}>Waiting for other managers...</p>
      </div>
    );
  }

  return (
    <div style={{ padding: '1rem' }}>
      <div style={{ marginBottom: '0.5rem' }}>
        <label htmlFor="bid-amount" style={{ display: 'block', marginBottom: '0.25rem', fontWeight: 'bold' }}>
          Your Bid (Round {round})
        </label>
        <input
          id="bid-amount"
          type="number"
          min={minBid}
          max={maxBid}
          value={amount}
          onChange={(e) => setAmount(parseInt(e.target.value, 10) || 0)}
          disabled={disabled || loading}
          style={{
            padding: '0.5rem',
            fontSize: '1rem',
            width: '120px',
            border: '1px solid #ccc',
            borderRadius: '4px',
          }}
        />
        <span style={{ marginLeft: '0.5rem', color: '#666', fontSize: '0.875rem' }}>
          ({minBid} - {maxBid})
        </span>
      </div>

      {error && (
        <p style={{ color: '#c00', fontSize: '0.875rem', margin: '0.5rem 0' }}>{error}</p>
      )}

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
        {loading ? 'Submitting...' : 'Submit Bid'}
      </button>
    </div>
  );
}
