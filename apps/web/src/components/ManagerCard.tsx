import { GlassCard } from './ui/GlassCard';
import { ProgressBar } from './ui/ProgressBar';
import type { AgentStreamState } from '../hooks/useAgentStreams';
import './ManagerCard.css';

interface ManagerInfo {
  id: string;
  name: string;
  role: 'human' | 'bot';
}

interface ManagerCardProps {
  manager: ManagerInfo;
  score: number;
  rank?: number;
  budget?: number;
  totalManagers?: number;
  statusText?: string;
  children?: React.ReactNode;
  expanded?: boolean;
  onClick?: () => void;
  executionState?: AgentStreamState;
  isExecutionPhase?: boolean;
  accentColor?: string;
}

const EXEC_STATUS_LABELS: Record<string, string> = {
  idle: 'waiting...',
  coding: 'coding',
  testing: 'testing',
  complete: 'done',
  failed: 'failed',
};

const EXEC_STATUS_CLASSES: Record<string, string> = {
  idle: '',
  coding: 'exec-coding',
  testing: 'exec-testing',
  complete: 'exec-complete',
  failed: 'exec-failed',
};

export function ManagerCard({
  manager,
  score,
  rank,
  budget,
  statusText,
  children,
  expanded = false,
  onClick,
  executionState,
  isExecutionPhase = false,
  accentColor,
}: ManagerCardProps) {
  const showExecMode = isExecutionPhase && executionState;

  return (
    <GlassCard expanded={expanded} onClick={onClick}>
      <div className={`manager-card ${isExecutionPhase ? 'exec-phase' : ''}`}>
        <div className="manager-card-header">
          <span className="manager-name">{manager.name}</span>
          <span className={`manager-role ${manager.role}`}>{manager.role}</span>
        </div>

        <div className="manager-score">
          <span className="score-value">{score.toFixed(1)}</span>
          <span className="score-label">pts</span>
          {rank != null && (
            <span className={`manager-rank ${rank === 1 ? 'first' : ''}`}>
              #{rank}
            </span>
          )}
        </div>

        {budget != null && !showExecMode && (
          <div style={{ fontSize: '0.75rem', color: 'var(--accent-purple, #a78bfa)', marginTop: '2px' }}>
            budget: {budget}
          </div>
        )}

        {/* Execution compact mode */}
        {showExecMode && executionState && (
          <div className="exec-compact">
            <ProgressBar
              value={
                executionState.totalTests > 0
                  ? executionState.testsPassed / executionState.totalTests
                  : executionState.lineCount > 0 ? 0.3 : 0
              }
              color={accentColor || 'var(--accent-green)'}
            />
            <div className="exec-stats">
              {executionState.totalTests > 0 ? (
                <span className="exec-tests">
                  {executionState.testsPassed}/{executionState.totalTests} tests
                </span>
              ) : executionState.lineCount > 0 ? (
                <span className="exec-lines">{executionState.lineCount} lines</span>
              ) : null}
              <span className={`exec-status-pill ${EXEC_STATUS_CLASSES[executionState.status]}`}>
                {EXEC_STATUS_LABELS[executionState.status]}
              </span>
            </div>
          </div>
        )}

        {!showExecMode && (
          <div className="manager-card-body">
            {statusText && !children && (
              <div className="manager-status">{statusText}</div>
            )}
            {children}
          </div>
        )}
      </div>
    </GlassCard>
  );
}
