import { useState } from 'react';
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
  challengeTitle?: string;
  challengeDescription?: string;
  dataCardTitle?: string;
  dataCardDescription?: string;
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
  challengeTitle,
  challengeDescription,
  dataCardTitle,
  dataCardDescription,
}: AgentTheaterProps) {
  const [showChallenge, setShowChallenge] = useState(false);
  const hasChallenge = !!challengeTitle;

  return (
    <div className={`agent-theater ${isQuadMode ? 'quad-mode' : 'focus-mode'}`}>
      {/* Header: challenge toggle + tabs (focus mode) */}
      <div className="theater-header">
        {hasChallenge && (
          <button
            className={`challenge-toggle ${showChallenge ? 'open' : ''}`}
            onClick={() => setShowChallenge((v) => !v)}
            title="view challenge"
          >
            <span className="challenge-toggle-title">{challengeTitle}</span>
            <span className="challenge-toggle-chevron">{showChallenge ? '\u25B4' : '\u25BE'}</span>
          </button>
        )}

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
      </div>

      {/* Expandable challenge panel */}
      {hasChallenge && showChallenge && (
        <div className="challenge-panel">
          <h4 className="challenge-panel-title">{challengeTitle}</h4>
          {challengeDescription && (
            <p className="challenge-panel-desc">{challengeDescription}</p>
          )}
          {dataCardTitle && (
            <div className="challenge-panel-datacard">
              <span className="challenge-panel-datacard-label">data card:</span>{' '}
              <strong>{dataCardTitle}</strong>
              {dataCardDescription && (
                <span className="challenge-panel-datacard-desc"> — {dataCardDescription}</span>
              )}
            </div>
          )}
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
