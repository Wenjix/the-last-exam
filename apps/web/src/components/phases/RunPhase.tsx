import type { AgentStreamsMap } from '../../hooks/useAgentStreams';
import { AgentTheater } from './AgentTheater';

interface ManagerInfo {
  id: string;
  name: string;
  role: 'human' | 'bot';
}

interface RunPhaseProps {
  round: number;
  managers: ManagerInfo[];
  streams: AgentStreamsMap;
  focusedAgent: string | null;
  onFocusAgent: (id: string | null) => void;
  isQuadMode: boolean;
  challengeTitle?: string;
  challengeDescription?: string;
  dataCardTitle?: string;
  dataCardDescription?: string;
}

export function RunPhase({
  managers,
  streams,
  focusedAgent,
  onFocusAgent,
  isQuadMode,
  challengeTitle,
  challengeDescription,
  dataCardTitle,
  dataCardDescription,
}: RunPhaseProps) {
  return (
    <AgentTheater
      managers={managers}
      streams={streams}
      focusedAgent={focusedAgent}
      onFocusAgent={onFocusAgent}
      isQuadMode={isQuadMode}
      challengeTitle={challengeTitle}
      challengeDescription={challengeDescription}
      dataCardTitle={dataCardTitle}
      dataCardDescription={dataCardDescription}
    />
  );
}
