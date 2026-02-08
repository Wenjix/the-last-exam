interface HiddenBidPhaseProps {
  round: number;
  onSubmitBid?: (amount: number) => void;
  remainingMs?: number;
  submitted?: boolean;
}

export function HiddenBidPhase({ round, onSubmitBid, remainingMs, submitted }: HiddenBidPhaseProps) {
  return (
    <div style={{ padding: '1rem' }}>
      <h2>Round {round} - Hidden Bid</h2>
      {remainingMs !== undefined && <p>Time remaining: {Math.ceil(remainingMs / 1000)}s</p>}
      {submitted ? (
        <p>Bid submitted. Waiting for other managers...</p>
      ) : (
        <div>
          <p>Place your bid for tool priority this round.</p>
          <input type="number" min={0} placeholder="Bid amount" id="bid-input" />
          <button onClick={() => {
            const input = document.getElementById('bid-input') as HTMLInputElement;
            if (input && onSubmitBid) onSubmitBid(parseInt(input.value, 10));
          }}>
            Submit Bid
          </button>
        </div>
      )}
    </div>
  );
}
