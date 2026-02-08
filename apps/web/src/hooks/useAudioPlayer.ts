import { useState, useCallback, useRef, useEffect } from 'react';

// === Types ===

export interface AudioQueueItem {
  id: string;
  audioData: ArrayBuffer | null;
  text: string;
}

export interface AudioPlayerState {
  muted: boolean;
  volume: number;
  paused: boolean;
  currentItem: AudioQueueItem | null;
  queueLength: number;
  currentText: string | null;
}

export interface AudioPlayerControls {
  enqueue: (item: AudioQueueItem) => void;
  toggleMute: () => void;
  setVolume: (volume: number) => void;
  togglePause: () => void;
  clear: () => void;
}

// === Hook ===

export function useAudioPlayer(): AudioPlayerState & AudioPlayerControls {
  const [muted, setMuted] = useState(false);
  const [volume, setVolumeState] = useState(1);
  const [paused, setPaused] = useState(false);
  const [currentItem, setCurrentItem] = useState<AudioQueueItem | null>(null);
  const [currentText, setCurrentText] = useState<string | null>(null);

  const queueRef = useRef<AudioQueueItem[]>([]);
  const seenIdsRef = useRef<Set<string>>(new Set());
  const audioElRef = useRef<HTMLAudioElement | null>(null);
  const isPlayingRef = useRef(false);
  const mutedRef = useRef(muted);
  const volumeRef = useRef(volume);
  const pausedRef = useRef(paused);

  // Keep refs in sync with state
  mutedRef.current = muted;
  volumeRef.current = volume;
  pausedRef.current = paused;

  // Advance to the next item in the queue
  const playNext = useCallback(() => {
    if (isPlayingRef.current) return;

    const next = queueRef.current.shift();
    if (!next) {
      setCurrentItem(null);
      setCurrentText(null);
      return;
    }

    setCurrentItem(next);
    setCurrentText(next.text);
    isPlayingRef.current = true;

    // If muted or no audio data, show text and auto-advance after a brief delay
    if (mutedRef.current || !next.audioData) {
      const timer = setTimeout(
        () => {
          isPlayingRef.current = false;
          playNext();
        },
        Math.max(1500, next.text.length * 40),
      );

      // Store timer id so we can cancel it
      audioElRef.current = null;
      // Reuse a simple cleanup via the ref - store the timer id
      (playNext as unknown as Record<string, unknown>).__textTimer = timer;
      return;
    }

    // Play audio
    try {
      const blob = new Blob([next.audioData], { type: 'audio/mpeg' });
      const url = URL.createObjectURL(blob);

      const audio = new Audio(url);
      audioElRef.current = audio;
      audio.volume = volumeRef.current;

      audio.onended = () => {
        URL.revokeObjectURL(url);
        audioElRef.current = null;
        isPlayingRef.current = false;
        playNext();
      };

      audio.onerror = () => {
        URL.revokeObjectURL(url);
        audioElRef.current = null;
        isPlayingRef.current = false;
        // On error, still advance to next item
        playNext();
      };

      audio.play().catch(() => {
        // Autoplay blocked or other error - advance
        URL.revokeObjectURL(url);
        audioElRef.current = null;
        isPlayingRef.current = false;
        playNext();
      });
    } catch {
      // Audio construction failed - advance
      isPlayingRef.current = false;
      playNext();
    }
  }, []);

  // Enqueue an audio item, deduplicate by id
  const enqueue = useCallback(
    (item: AudioQueueItem) => {
      if (seenIdsRef.current.has(item.id)) return;
      seenIdsRef.current.add(item.id);
      queueRef.current.push(item);

      // If nothing is currently playing, start playback
      if (!isPlayingRef.current) {
        playNext();
      }
    },
    [playNext],
  );

  const toggleMute = useCallback(() => {
    setMuted((prev) => {
      const next = !prev;
      if (audioElRef.current) {
        audioElRef.current.muted = next;
      }
      return next;
    });
  }, []);

  const setVolume = useCallback((v: number) => {
    const clamped = Math.max(0, Math.min(1, v));
    setVolumeState(clamped);
    if (audioElRef.current) {
      audioElRef.current.volume = clamped;
    }
  }, []);

  const togglePause = useCallback(() => {
    setPaused((prev) => {
      const next = !prev;
      if (audioElRef.current) {
        if (next) {
          audioElRef.current.pause();
        } else {
          audioElRef.current.play().catch(() => {
            // Ignore play errors on resume
          });
        }
      }
      return next;
    });
  }, []);

  const clear = useCallback(() => {
    queueRef.current = [];
    seenIdsRef.current.clear();
    if (audioElRef.current) {
      audioElRef.current.pause();
      audioElRef.current = null;
    }
    isPlayingRef.current = false;
    setCurrentItem(null);
    setCurrentText(null);
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (audioElRef.current) {
        audioElRef.current.pause();
        audioElRef.current = null;
      }
      isPlayingRef.current = false;
    };
  }, []);

  return {
    muted,
    volume,
    paused,
    currentItem,
    currentText,
    queueLength: queueRef.current.length,
    enqueue,
    toggleMute,
    setVolume,
    togglePause,
    clear,
  };
}
