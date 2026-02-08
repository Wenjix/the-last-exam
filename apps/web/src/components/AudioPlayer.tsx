import { useCallback } from 'react';
import type { AudioPlayerState, AudioPlayerControls } from '../hooks/useAudioPlayer';

type AudioPlayerProps = AudioPlayerState & AudioPlayerControls;

export function AudioPlayer({
  muted,
  volume,
  paused,
  currentItem,
  currentText,
  queueLength,
  toggleMute,
  setVolume,
  togglePause,
}: AudioPlayerProps) {
  const handleVolumeChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setVolume(parseFloat(e.target.value));
    },
    [setVolume],
  );

  const hasAudio = currentItem?.audioData != null;
  const isTextOnly = !hasAudio || muted;
  const isIdle = currentItem == null;

  return (
    <div
      style={{
        padding: '0.75rem 1rem',
        backgroundColor: '#f5f5f5',
        borderRadius: '4px',
        display: 'flex',
        flexDirection: 'column',
        gap: '0.5rem',
      }}
    >
      {/* Commentary text fallback - always visible */}
      <div
        style={{
          minHeight: '2rem',
          padding: '0.5rem',
          backgroundColor: 'white',
          borderRadius: '4px',
          border: '1px solid #e0e0e0',
          fontSize: '0.9375rem',
          lineHeight: '1.4',
          color: isIdle ? '#999' : '#333',
          fontStyle: isIdle ? 'italic' : 'normal',
        }}
      >
        {currentText || (isIdle ? 'Waiting for commentary...' : '')}
        {isTextOnly && !isIdle && (
          <span
            style={{
              display: 'inline-block',
              marginLeft: '0.5rem',
              fontSize: '0.75rem',
              color: '#999',
              verticalAlign: 'middle',
            }}
          >
            {muted ? '(muted)' : '(text only)'}
          </span>
        )}
      </div>

      {/* Controls row */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.75rem',
        }}
      >
        {/* Playback state indicator */}
        <span
          style={{
            display: 'inline-block',
            width: '8px',
            height: '8px',
            borderRadius: '50%',
            backgroundColor: isIdle ? '#ccc' : paused ? '#ff9800' : '#4caf50',
            flexShrink: 0,
          }}
          title={isIdle ? 'Idle' : paused ? 'Paused' : 'Playing'}
        />

        {/* Pause/Resume button */}
        <button
          onClick={togglePause}
          disabled={isIdle}
          style={{
            padding: '0.25rem 0.75rem',
            fontSize: '0.875rem',
            backgroundColor: isIdle ? '#e0e0e0' : paused ? '#fff3e0' : '#e8f5e9',
            color: isIdle ? '#999' : '#333',
            border: '1px solid #ccc',
            borderRadius: '4px',
            cursor: isIdle ? 'not-allowed' : 'pointer',
            minWidth: '70px',
          }}
        >
          {paused ? 'Resume' : 'Pause'}
        </button>

        {/* Mute toggle button */}
        <button
          onClick={toggleMute}
          style={{
            padding: '0.25rem 0.75rem',
            fontSize: '0.875rem',
            backgroundColor: muted ? '#ffebee' : 'white',
            color: muted ? '#c00' : '#333',
            border: `1px solid ${muted ? '#ef9a9a' : '#ccc'}`,
            borderRadius: '4px',
            cursor: 'pointer',
            minWidth: '60px',
          }}
        >
          {muted ? 'Unmute' : 'Mute'}
        </button>

        {/* Volume slider */}
        <label
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.375rem',
            fontSize: '0.8125rem',
            color: '#666',
          }}
        >
          Vol
          <input
            type="range"
            min="0"
            max="1"
            step="0.05"
            value={volume}
            onChange={handleVolumeChange}
            disabled={muted}
            style={{
              width: '80px',
              cursor: muted ? 'not-allowed' : 'pointer',
              opacity: muted ? 0.5 : 1,
            }}
          />
          <span style={{ minWidth: '2rem', textAlign: 'right', fontFamily: 'monospace' }}>
            {Math.round(volume * 100)}%
          </span>
        </label>

        {/* Queue count */}
        {queueLength > 0 && (
          <span
            style={{
              marginLeft: 'auto',
              fontSize: '0.75rem',
              color: '#999',
            }}
          >
            {queueLength} queued
          </span>
        )}
      </div>
    </div>
  );
}
