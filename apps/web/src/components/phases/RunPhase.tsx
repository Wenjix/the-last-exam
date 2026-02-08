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
}

export function RunPhase({
  managers,
  streams,
  focusedAgent,
  onFocusAgent,
  isQuadMode,
}: RunPhaseProps) {
  return (
    <AgentTheater
      managers={managers}
      streams={streams}
      focusedAgent={focusedAgent}
      onFocusAgent={onFocusAgent}
      isQuadMode={isQuadMode}
    />
  );
}
