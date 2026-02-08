import type { MatchPhase } from '../../hooks/useMatchSocket';

interface HeaderProps {
  round: number;
  phase: MatchPhase;
  languageSelector?: React.ReactNode;
  audioControls?: React.ReactNode;
}

const PHASE_LABELS: Record<MatchPhase, { label: string; color: string }> = {
  briefing: { label: 'briefing', color: 'cyan' },
  hidden_bid: { label: 'bidding', color: 'pink' },
  bid_resolve: { label: 'bid results', color: 'pink' },
  equip: { label: 'equip', color: 'orange' },
  run: { label: 'running', color: 'green' },
  resolve: { label: 'results', color: 'orange' },
  final_standings: { label: 'final', color: 'purple' },
};

export function Header({ round, phase, languageSelector, audioControls }: HeaderProps) {
  const phaseInfo = PHASE_LABELS[phase];

  return (
    <>
      <div className="title">the last exam</div>
      <div className="center">
        <span className={`pill ${phaseInfo.color}`}>
          round {round}
        </span>
        <span className={`pill ${phaseInfo.color}`}>
          {phaseInfo.label}
        </span>
      </div>
      <div className="controls">
        {languageSelector}
        {audioControls}
      </div>
    </>
  );
}
