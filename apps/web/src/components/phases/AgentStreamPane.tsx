import { useRef, useEffect, useState, useCallback } from 'react';
import type { AgentStreamState } from '../../hooks/useAgentStreams';
import { SyntaxHighlight } from '../ui/SyntaxHighlight';
import './AgentStreamPane.css';

interface AgentStreamPaneProps {
  managerName: string;
  stream: AgentStreamState;
  accentColor: string;
  isFocused: boolean;
  onFocus: () => void;
}

const STATUS_LABELS: Record<string, string> = {
  idle: 'waiting...',
  coding: 'generating code',
  testing: 'running tests',
  complete: 'complete',
  failed: 'failed',
};

const STATUS_DOTS: Record<string, string> = {
  idle: 'status-idle',
  coding: 'status-coding',
  testing: 'status-testing',
  complete: 'status-complete',
  failed: 'status-failed',
};

export function AgentStreamPane({
  managerName,
  stream,
  accentColor,
  isFocused,
  onFocus,
}: AgentStreamPaneProps) {
  const codeRef = useRef<HTMLDivElement>(null);
  const [autoScroll, setAutoScroll] = useState(true);

  // Auto-scroll to bottom when new code arrives
  useEffect(() => {
    if (autoScroll && codeRef.current) {
      codeRef.current.scrollTop = codeRef.current.scrollHeight;
    }
  }, [stream.codeBuffer, autoScroll]);

  // Detect manual scroll
  const handleScroll = useCallback(() => {
    if (!codeRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = codeRef.current;
    const atBottom = scrollHeight - scrollTop - clientHeight < 30;
    setAutoScroll(atBottom);
  }, []);

  const jumpToLatest = useCallback(() => {
    setAutoScroll(true);
    if (codeRef.current) {
      codeRef.current.scrollTop = codeRef.current.scrollHeight;
    }
  }, []);

  return (
    <div
      className={`agent-stream-pane ${isFocused ? 'focused' : ''}`}
      onClick={onFocus}
    >
      {/* Header */}
      <div className="stream-header">
        <div className="stream-header-left">
          <span className={`status-dot ${STATUS_DOTS[stream.status]}`} />
          <span className="stream-agent-name" style={{ color: accentColor }}>
            {managerName}
          </span>
          <span className="stream-status-label">{STATUS_LABELS[stream.status]}</span>
        </div>
        <div className="stream-header-right">
          {stream.lineCount > 0 && (
            <span className="stream-line-count">{stream.lineCount} lines</span>
          )}
          {stream.language && (
            <span className="pill stream-lang-pill">{stream.language}</span>
          )}
        </div>
      </div>

      {/* Code area */}
      <div
        className="stream-code-area"
        ref={codeRef}
        onScroll={handleScroll}
      >
        {stream.status === 'idle' ? (
          <div className="stream-idle-msg">waiting for agent to start...</div>
        ) : (
          <>
            <SyntaxHighlight code={stream.codeBuffer} language={stream.language} />
            {(stream.status === 'coding' || stream.status === 'testing') && (
              <span className="typing-cursor" />
            )}
          </>
        )}

        {!autoScroll && stream.status !== 'complete' && stream.status !== 'failed' && (
          <button className="jump-to-latest" onClick={jumpToLatest}>
            jump to latest
          </button>
        )}
      </div>

      {/* Test results footer */}
      {(stream.testResults.length > 0 || stream.totalTests > 0) && (
        <div className="stream-test-footer">
          {Array.from({ length: stream.totalTests }, (_, i) => {
            const result = stream.testResults.find((r) => r.testIndex === i);
            return (
              <span
                key={i}
                className={`test-indicator ${
                  result ? (result.passed ? 'test-pass' : 'test-fail') : 'test-pending'
                }`}
                title={
                  result
                    ? result.passed
                      ? `test ${i + 1}: passed`
                      : `test ${i + 1}: ${result.errorMessage || 'failed'}`
                    : `test ${i + 1}: pending`
                }
              >
                {result ? (result.passed ? '\u2713' : '\u2717') : '\u25CB'}
                <span className="test-label">{i + 1}</span>
              </span>
            );
          })}
        </div>
      )}
    </div>
  );
}
