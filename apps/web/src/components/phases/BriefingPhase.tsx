interface BriefingPhaseProps {
  round: number;
  challengeTitle?: string;
  challengeDescription?: string;
}

export function BriefingPhase({ round, challengeTitle, challengeDescription }: BriefingPhaseProps) {
  return (
    <div style={{ padding: '1rem' }}>
      <h2>Round {round} - Briefing</h2>
      <h3>{challengeTitle || 'Loading challenge...'}</h3>
      <p>{challengeDescription || 'Challenge details will appear here.'}</p>
    </div>
  );
}
