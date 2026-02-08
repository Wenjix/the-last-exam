import { useCallback } from 'react';
import { useReplay, PLAYBACK_SPEEDS } from '../hooks/useReplay';
import type { ReplayEvent } from '../hooks/useReplay';
import { GlassCard } from './ui/GlassCard';
import { LoadingDots } from './ui/LoadingDots';
import { IridescenceBackground } from './ui/IridescenceBackground';

interface ReplayViewerProps {
  matchId: string;
  serverUrl?: string;
}

function formatTimestamp(ts: string): string {
  try {
    return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  } catch {
    return ts;
  }
}

function eventLabel(event: ReplayEvent): string {
  switch (event.type) {
    case 'phase_transition':
      return `phase: ${event.phase ?? 'unknown'}${event.round != null ? ` (r${event.round})` : ''}`;
    case 'round_result': return `round ${event.round ?? '?'} result`;
    case 'commentary_update': return 'commentary';
    case 'bid_submitted': return 'bid submitted';
    case 'equip_submitted': return 'equipment submitted';
    case 'run_started': return 'run started';
    case 'run_completed': return 'run completed';
    case 'final_standings': return 'final standings';
    default: return event.type;
  }
}

function isPhaseTransition(event: ReplayEvent): boolean {
  return event.type === 'phase_transition';
}

export function ReplayViewer({ matchId, serverUrl }: ReplayViewerProps) {
  const {
    loading, error, replayData, currentIndex, currentEvent,
    playing, playbackSpeed, progress, totalEvents, phaseTransitions,
    seek, togglePlay, setPlaybackSpeed, restart,
  } = useReplay(matchId, serverUrl);

  const handleScrub = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => seek(parseInt(e.target.value, 10)),
    [seek],
  );

  if (loading) {
    return (
      <div style={{
        position: 'fixed', inset: 0, display: 'flex', alignItems: 'center',
        justifyContent: 'center', background: 'var(--bg-match)',
      }}>
        <IridescenceBackground />
        <div style={{ position: 'relative', zIndex: 5, textAlign: 'center' }}>
          <LoadingDots />
          <p style={{ color: 'var(--text-muted)', fontSize: '0.8125rem', marginTop: '1rem' }}>
            loading replay...
          </p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{
        position: 'fixed', inset: 0, display: 'flex', alignItems: 'center',
        justifyContent: 'center', background: 'var(--bg-match)',
      }}>
        <GlassCard>
          <div style={{ padding: '2rem', textAlign: 'center' }}>
            <h3 style={{ color: 'var(--accent-pink)', marginBottom: '0.5rem' }}>connection error</h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.8125rem' }}>{error}</p>
          </div>
        </GlassCard>
      </div>
    );
  }

  if (!replayData || totalEvents === 0) {
    return (
      <div style={{
        position: 'fixed', inset: 0, display: 'flex', alignItems: 'center',
        justifyContent: 'center', background: 'var(--bg-match)',
      }}>
        <GlassCard>
          <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
            no replay data available.
          </div>
        </GlassCard>
      </div>
    );
  }

  const events = replayData.events;

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'var(--bg-match)',
      display: 'flex', flexDirection: 'column', padding: '1rem',
    }}>
      <IridescenceBackground />
      <div style={{ position: 'relative', zIndex: 5, display: 'flex', flexDirection: 'column', gap: '0.75rem', flex: 1, minHeight: 0 }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 style={{ fontSize: '1rem', fontWeight: 200, color: 'var(--text-primary)' }}>match replay</h3>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
            {replayData.managers.map((m) => m.name).join(' vs ')}
          </span>
        </div>

        {/* Timeline */}
        <GlassCard>
          <div style={{ padding: '0.75rem' }}>
            <input
              type="range"
              min="0"
              max={Math.max(0, totalEvents - 1)}
              value={currentIndex}
              onChange={handleScrub}
              style={{ width: '100%', cursor: 'pointer', accentColor: 'var(--accent-pink)' }}
              aria-label="timeline scrubber"
            />
            {totalEvents > 1 && (
              <div style={{ position: 'relative', height: '4px', marginTop: '2px' }}>
                {phaseTransitions.map((idx) => (
                  <div
                    key={idx}
                    style={{
                      position: 'absolute',
                      left: `${(idx / (totalEvents - 1)) * 100}%`,
                      width: '2px', height: '4px',
                      backgroundColor: 'var(--accent-cyan)',
                      borderRadius: '1px',
                      transform: 'translateX(-50%)',
                    }}
                  />
                ))}
              </div>
            )}
            <div style={{
              display: 'flex', justifyContent: 'space-between',
              fontSize: '0.6875rem', color: 'var(--text-muted)', marginTop: '4px',
            }}>
              <span>event {currentIndex + 1} / {totalEvents}</span>
              <span>{Math.round(progress * 100)}%</span>
            </div>
          </div>
        </GlassCard>

        {/* Controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <button onClick={togglePlay} className={`glass-button ${playing ? '' : 'primary'}`}>
            {playing ? 'pause' : 'play'}
          </button>
          <button onClick={restart} className="glass-button">restart</button>
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginLeft: '0.5rem' }}>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>speed:</span>
            {PLAYBACK_SPEEDS.map((speed) => (
              <button
                key={speed}
                onClick={() => setPlaybackSpeed(speed)}
                className={`glass-button ${playbackSpeed === speed ? 'primary' : ''}`}
                style={{ padding: '2px 8px', fontSize: '0.75rem' }}
              >
                {speed}x
              </button>
            ))}
          </div>
          {currentEvent && (
            <span style={{
              marginLeft: 'auto', fontSize: '0.75rem',
              fontFamily: 'var(--font-body)', color: 'var(--text-muted)',
            }}>
              {formatTimestamp(currentEvent.timestamp)}
            </span>
          )}
        </div>

        {/* Current event */}
        {currentEvent && (
          <GlassCard>
            <div style={{ padding: '0.75rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.25rem' }}>
                <strong style={{
                  fontSize: '0.8125rem',
                  color: isPhaseTransition(currentEvent) ? 'var(--accent-cyan)' : 'var(--text-primary)',
                }}>
                  {eventLabel(currentEvent)}
                </strong>
                <span style={{ fontSize: '0.6875rem', color: 'var(--text-muted)' }}>#{currentEvent.index}</span>
              </div>
              {currentEvent.data && Object.keys(currentEvent.data).length > 0 && (
                <pre style={{
                  margin: 0, fontSize: '0.75rem', color: 'var(--text-secondary)',
                  whiteSpace: 'pre-wrap', wordBreak: 'break-word',
                  maxHeight: '120px', overflow: 'auto',
                }}>
                  {JSON.stringify(currentEvent.data, null, 2)}
                </pre>
              )}
            </div>
          </GlassCard>
        )}

        {/* Event list */}
        <GlassCard className="hide-scrollbar" style={{ flex: 1, minHeight: 0 }}>
          <div style={{ maxHeight: '100%', overflowY: 'auto', padding: '0.5rem' }} className="hide-scrollbar">
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
                    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); seek(i); }
                  }}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '0.5rem',
                    padding: '0.375rem 0.5rem', fontSize: '0.75rem',
                    borderRadius: '4px', cursor: 'pointer',
                    background: isCurrent ? 'rgba(255, 255, 255, 0.08)' : 'transparent',
                    borderLeft: isPhase ? '2px solid var(--accent-cyan)' : '2px solid transparent',
                    fontWeight: isCurrent ? 400 : 200,
                    color: isCurrent ? 'var(--text-primary)' : 'var(--text-secondary)',
                  }}
                >
                  <span style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-body)', minWidth: '1.5rem', textAlign: 'right' }}>
                    {i + 1}
                  </span>
                  <span style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-body)', minWidth: '4rem' }}>
                    {formatTimestamp(event.timestamp)}
                  </span>
                  <span style={{ flex: 1 }}>{eventLabel(event)}</span>
                  {event.round != null && !isPhase && (
                    <span style={{ color: 'var(--text-muted)', fontSize: '0.6875rem' }}>r{event.round}</span>
                  )}
                </div>
              );
            })}
          </div>
        </GlassCard>
      </div>
    </div>
  );
}
