import type { MatchPhase } from '../../hooks/useMatchSocket';

interface HeaderProps {
  round: number;
  phase: MatchPhase;
  languageSelector?: React.ReactNode;
  audioControls?: React.ReactNode;
}

const PHASE_LABELS: Record<MatchPhase, { label: string; color: string }> = {
  briefing: { label: 'briefing', color: 'cyan' },
  bidding: { label: 'bidding', color: 'pink' },
  strategy: { label: 'strategy', color: 'orange' },
  execution: { label: 'execution', color: 'green' },
  scoring: { label: 'scoring', color: 'orange' },
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
