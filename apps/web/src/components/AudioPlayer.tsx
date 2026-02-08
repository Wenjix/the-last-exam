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

  const isIdle = currentItem == null;

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
      {/* Status dot */}
      <span
        style={{
          width: '6px',
          height: '6px',
          borderRadius: '50%',
          backgroundColor: isIdle
            ? 'var(--text-muted)'
            : paused
              ? 'var(--accent-orange)'
              : 'var(--accent-green)',
          flexShrink: 0,
        }}
      />

      {/* Pause/Resume */}
      <button
        onClick={togglePause}
        disabled={isIdle}
        className="glass-button"
        style={{ padding: '2px 8px', fontSize: '0.6875rem' }}
      >
        {paused ? 'resume' : 'pause'}
      </button>

      {/* Mute */}
      <button
        onClick={toggleMute}
        className={`glass-button ${muted ? 'primary' : ''}`}
        style={{ padding: '2px 8px', fontSize: '0.6875rem' }}
      >
        {muted ? 'unmute' : 'mute'}
      </button>

      {/* Volume */}
      <input
        type="range"
        min="0"
        max="1"
        step="0.05"
        value={volume}
        onChange={handleVolumeChange}
        disabled={muted}
        style={{
          width: '60px',
          cursor: muted ? 'not-allowed' : 'pointer',
          opacity: muted ? 0.3 : 0.7,
          accentColor: 'var(--accent-pink)',
        }}
      />

      {/* Queue */}
      {queueLength > 0 && (
        <span style={{ fontSize: '0.625rem', color: 'var(--text-muted)' }}>
          {queueLength}q
        </span>
      )}
    </div>
  );
}
