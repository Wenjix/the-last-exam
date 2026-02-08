import type { AgentStreamsMap } from '../../hooks/useAgentStreams';
import { AgentStreamPane } from './AgentStreamPane';
import './AgentTheater.css';

interface ManagerInfo {
  id: string;
  name: string;
  role: 'human' | 'bot';
}

const AGENT_COLORS = [
  'var(--accent-cyan)',
  'var(--accent-pink)',
  'var(--accent-green)',
  'var(--accent-orange)',
];

interface AgentTheaterProps {
  managers: ManagerInfo[];
  streams: AgentStreamsMap;
  focusedAgent: string | null;
  onFocusAgent: (id: string | null) => void;
  isQuadMode: boolean;
}

function createIdleState() {
  return {
    status: 'idle' as const,
    language: 'python',
    codeBuffer: '',
    lineCount: 0,
    testResults: [],
    totalTests: 0,
    testsPassed: 0,
    durationMs: 0,
  };
}

export function AgentTheater({
  managers,
  streams,
  focusedAgent,
  onFocusAgent,
  isQuadMode,
}: AgentTheaterProps) {
  return (
    <div className={`agent-theater ${isQuadMode ? 'quad-mode' : 'focus-mode'}`}>
      {/* Tab bar in focus mode */}
      {!isQuadMode && (
        <div className="theater-tabs">
          {managers.map((m, i) => (
            <button
              key={m.id}
              className={`theater-tab ${focusedAgent === m.id ? 'active' : ''}`}
              style={{
                '--tab-color': AGENT_COLORS[i % AGENT_COLORS.length],
              } as React.CSSProperties}
              onClick={(e) => {
                e.stopPropagation();
                onFocusAgent(m.id);
              }}
            >
              {m.name}
            </button>
          ))}
          <button
            className="theater-tab quad-btn"
            onClick={(e) => {
              e.stopPropagation();
              onFocusAgent(null);
            }}
            title="quad view (esc)"
          >
            {'\u2B1A'}
          </button>
        </div>
      )}

      {/* Panes */}
      <div className="theater-panes">
        {managers.map((m, i) => {
          const stream = streams[m.id] ?? createIdleState();
          const isVisible = isQuadMode || focusedAgent === m.id;

          if (!isVisible) return null;

          return (
            <AgentStreamPane
              key={m.id}
              managerName={m.name}
              stream={stream}
              accentColor={AGENT_COLORS[i % AGENT_COLORS.length]}
              isFocused={focusedAgent === m.id}
              onFocus={() => onFocusAgent(isQuadMode ? m.id : null)}
            />
          );
        })}
      </div>
    </div>
  );
}
