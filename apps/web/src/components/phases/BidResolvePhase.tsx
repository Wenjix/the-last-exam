import { GlassCard } from '../ui/GlassCard';

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
    <GlassCard>
      <div style={{ padding: '1rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '0.75rem' }}>
          <span className="pill pink">round {round}</span>
          <span className="pill pink">bid results</span>
        </div>
        {results ? (
          <table className="glass-table">
            <thead>
              <tr>
                <th>pick</th>
                <th>manager</th>
                <th>bid</th>
              </tr>
            </thead>
            <tbody>
              {[...results].sort((a, b) => a.pickOrder - b.pickOrder).map((r) => (
                <tr key={r.managerId}>
                  <td>#{r.pickOrder}</td>
                  <td>{r.managerName}</td>
                  <td style={{ color: 'var(--accent-pink)' }}>{r.amount}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.8125rem' }}>revealing bids...</p>
        )}
      </div>
    </GlassCard>
  );
}
