import { useCallback } from 'react';
import { useReplay, PLAYBACK_SPEEDS } from '../hooks/useReplay';
import type { ReplayEvent } from '../hooks/useReplay';
import { LoadingSpinner } from './LoadingSpinner';
import { NetworkError } from './NetworkError';

interface ReplayViewerProps {
  matchId: string;
  serverUrl?: string;
}

// === Helpers ===

function formatTimestamp(ts: string): string {
  try {
    const date = new Date(ts);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  } catch {
    return ts;
  }
}

function eventLabel(event: ReplayEvent): string {
  switch (event.type) {
    case 'phase_transition':
      return `Phase: ${event.phase ?? 'unknown'}${event.round != null ? ` (R${event.round})` : ''}`;
    case 'round_result':
      return `Round ${event.round ?? '?'} Result`;
    case 'commentary_update':
      return `Commentary`;
    case 'bid_submitted':
      return `Bid Submitted`;
    case 'equip_submitted':
      return `Equipment Submitted`;
    case 'run_started':
      return `Run Started`;
    case 'run_completed':
      return `Run Completed`;
    case 'final_standings':
      return `Final Standings`;
    default:
      return event.type;
  }
}

function isPhaseTransition(event: ReplayEvent): boolean {
  return event.type === 'phase_transition';
}

// === Component ===

export function ReplayViewer({ matchId, serverUrl }: ReplayViewerProps) {
  const {
    loading,
    error,
    replayData,
    currentIndex,
    currentEvent,
    playing,
    playbackSpeed,
    progress,
    totalEvents,
    phaseTransitions,
    seek,
    togglePlay,
    setPlaybackSpeed,
    restart,
  } = useReplay(matchId, serverUrl);

  const handleScrub = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      seek(parseInt(e.target.value, 10));
    },
    [seek],
  );

  const handleSpeedChange = useCallback(
    (speed: number) => {
      setPlaybackSpeed(speed);
    },
    [setPlaybackSpeed],
  );

  // Loading state
  if (loading) {
    return <LoadingSpinner message="Loading replay..." />;
  }

  // Error state
  if (error) {
    return <NetworkError message={error} />;
  }

  // No data
  if (!replayData || totalEvents === 0) {
    return (
      <div style={{ padding: '2rem', textAlign: 'center', color: '#666' }}>
        <p>No replay data available for this match.</p>
      </div>
    );
  }

  const events = replayData.events;

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '0.75rem',
        padding: '1rem',
      }}
    >
      {/* Header */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <h3 style={{ margin: 0 }}>Match Replay</h3>
        <span style={{ fontSize: '0.8125rem', color: '#666' }}>
          {replayData.managers.map((m) => m.name).join(' vs ')}
        </span>
      </div>

      {/* Timeline scrubber */}
      <div style={{ position: 'relative' }}>
        <input
          type="range"
          min="0"
          max={Math.max(0, totalEvents - 1)}
          value={currentIndex}
          onChange={handleScrub}
          style={{
            width: '100%',
            cursor: 'pointer',
          }}
          aria-label="Timeline scrubber"
        />

        {/* Phase transition markers */}
        {totalEvents > 1 && (
          <div
            style={{
              position: 'relative',
              height: '6px',
              marginTop: '2px',
            }}
          >
            {phaseTransitions.map((idx) => {
              const leftPercent = (idx / (totalEvents - 1)) * 100;
              return (
                <div
                  key={idx}
                  style={{
                    position: 'absolute',
                    left: `${leftPercent}%`,
                    top: 0,
                    width: '3px',
                    height: '6px',
                    backgroundColor: '#1976d2',
                    borderRadius: '1px',
                    transform: 'translateX(-50%)',
                  }}
                  title={`Phase transition at event ${idx}`}
                />
              );
            })}
          </div>
        )}

        {/* Progress label */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            fontSize: '0.75rem',
            color: '#999',
            marginTop: '2px',
          }}
        >
          <span>Event {currentIndex + 1} / {totalEvents}</span>
          <span>{Math.round(progress * 100)}%</span>
        </div>
      </div>

      {/* Playback controls */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem',
        }}
      >
        {/* Play/Pause */}
        <button
          onClick={togglePlay}
          style={{
            padding: '0.375rem 1rem',
            fontSize: '0.875rem',
            backgroundColor: playing ? '#fff3e0' : '#e8f5e9',
            color: '#333',
            border: '1px solid #ccc',
            borderRadius: '4px',
            cursor: 'pointer',
            minWidth: '70px',
          }}
        >
          {playing ? 'Pause' : 'Play'}
        </button>

        {/* Restart */}
        <button
          onClick={restart}
          style={{
            padding: '0.375rem 0.75rem',
            fontSize: '0.875rem',
            backgroundColor: 'white',
            color: '#333',
            border: '1px solid #ccc',
            borderRadius: '4px',
            cursor: 'pointer',
          }}
        >
          Restart
        </button>

        {/* Speed selector */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.25rem',
            marginLeft: '0.5rem',
          }}
        >
          <span style={{ fontSize: '0.8125rem', color: '#666' }}>Speed:</span>
          {PLAYBACK_SPEEDS.map((speed) => (
            <button
              key={speed}
              onClick={() => handleSpeedChange(speed)}
              style={{
                padding: '0.25rem 0.5rem',
                fontSize: '0.8125rem',
                backgroundColor: playbackSpeed === speed ? '#1976d2' : 'white',
                color: playbackSpeed === speed ? 'white' : '#333',
                border: `1px solid ${playbackSpeed === speed ? '#1976d2' : '#ccc'}`,
                borderRadius: '4px',
                cursor: 'pointer',
              }}
            >
              {speed}x
            </button>
          ))}
        </div>

        {/* Current timestamp */}
        {currentEvent && (
          <span
            style={{
              marginLeft: 'auto',
              fontSize: '0.8125rem',
              fontFamily: 'monospace',
              color: '#666',
            }}
          >
            {formatTimestamp(currentEvent.timestamp)}
          </span>
        )}
      </div>

      {/* Current event detail */}
      {currentEvent && (
        <div
          style={{
            padding: '0.75rem',
            backgroundColor: isPhaseTransition(currentEvent) ? '#e3f2fd' : '#f5f5f5',
            borderRadius: '4px',
            border: isPhaseTransition(currentEvent) ? '1px solid #90caf9' : '1px solid #e0e0e0',
          }}
        >
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '0.25rem',
            }}
          >
            <strong style={{ fontSize: '0.9375rem' }}>{eventLabel(currentEvent)}</strong>
            <span style={{ fontSize: '0.75rem', color: '#999' }}>
              #{currentEvent.index}
            </span>
          </div>
          {currentEvent.data && Object.keys(currentEvent.data).length > 0 && (
            <pre
              style={{
                margin: 0,
                fontSize: '0.8125rem',
                color: '#555',
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
                maxHeight: '120px',
                overflow: 'auto',
              }}
            >
              {JSON.stringify(currentEvent.data, null, 2)}
            </pre>
          )}
        </div>
      )}

      {/* Event list */}
      <div
        style={{
          maxHeight: '300px',
          overflowY: 'auto',
          border: '1px solid #e0e0e0',
          borderRadius: '4px',
        }}
      >
        {events.map((event, i) => {
          const isCurrent = i === currentIndex;
          const isPhase = isPhaseTransition(event);

          return (
            <div
              key={i}
              onClick={() => seek(i)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  seek(i);
                }
              }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                padding: '0.375rem 0.75rem',
                fontSize: '0.8125rem',
                backgroundColor: isCurrent ? '#e3f2fd' : isPhase ? '#fafafa' : 'white',
                borderBottom: i < events.length - 1 ? '1px solid #f0f0f0' : 'none',
                borderLeft: isPhase ? '3px solid #1976d2' : '3px solid transparent',
                cursor: 'pointer',
                fontWeight: isCurrent ? 'bold' : 'normal',
              }}
            >
              <span style={{ color: '#999', fontFamily: 'monospace', minWidth: '2rem', textAlign: 'right' }}>
                {i + 1}
              </span>
              <span style={{ color: '#999', fontFamily: 'monospace', minWidth: '5rem' }}>
                {formatTimestamp(event.timestamp)}
              </span>
              <span style={{ flex: 1 }}>{eventLabel(event)}</span>
              {event.round != null && !isPhase && (
                <span style={{ color: '#999', fontSize: '0.75rem' }}>R{event.round}</span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
