interface BidResult {
  managerId: string;
  managerName: string;
  amount: number;
  pickOrder: number;
}

interface BidResolvePhaseProps {
  round: number;
  results?: BidResult[];
}

export function BidResolvePhase({ round, results }: BidResolvePhaseProps) {
  return (
    <div style={{ padding: '1rem' }}>
      <h2>Round {round} - Bid Results</h2>
      {results ? (
        <table style={{ borderCollapse: 'collapse', width: '100%' }}>
          <thead>
            <tr>
              <th style={{ border: '1px solid #ccc', padding: '0.5rem' }}>Pick Order</th>
              <th style={{ border: '1px solid #ccc', padding: '0.5rem' }}>Manager</th>
              <th style={{ border: '1px solid #ccc', padding: '0.5rem' }}>Bid</th>
            </tr>
          </thead>
          <tbody>
            {results.sort((a, b) => a.pickOrder - b.pickOrder).map((r) => (
              <tr key={r.managerId}>
                <td style={{ border: '1px solid #ccc', padding: '0.5rem' }}>{r.pickOrder}</td>
                <td style={{ border: '1px solid #ccc', padding: '0.5rem' }}>{r.managerName}</td>
                <td style={{ border: '1px solid #ccc', padding: '0.5rem' }}>{r.amount}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <p>Revealing bids...</p>
      )}
    </div>
  );
}
