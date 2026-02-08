import { useState, useEffect, useRef, useCallback } from 'react';

// === Types ===

export interface ReplayEvent {
  index: number;
  timestamp: string;
  type: string;
  round?: number;
  phase?: string;
  data: Record<string, unknown>;
}

export interface ReplayData {
  matchId: string;
  startedAt: string;
  endedAt: string;
  events: ReplayEvent[];
  managers: Array<{ id: string; name: string }>;
}

export interface ReplayState {
  loading: boolean;
  error: string | null;
  replayData: ReplayData | null;
  currentIndex: number;
  currentEvent: ReplayEvent | null;
  playing: boolean;
  playbackSpeed: number;
  progress: number;
  totalEvents: number;
  phaseTransitions: number[];
}

export interface ReplayControls {
  seek: (index: number) => void;
  seekToTime: (timestamp: string) => void;
  togglePlay: () => void;
  setPlaybackSpeed: (speed: number) => void;
  restart: () => void;
}

// === Hook ===

const PLAYBACK_SPEEDS = [1, 2, 4];
const BASE_INTERVAL_MS = 1000;

export function useReplay(matchId: string, serverUrl?: string): ReplayState & ReplayControls {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [replayData, setReplayData] = useState<ReplayData | null>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [playbackSpeed, setPlaybackSpeedState] = useState(1);

  const intervalRef = useRef<ReturnType<typeof setInterval> | undefined>(undefined);
  const playingRef = useRef(playing);
  const speedRef = useRef(playbackSpeed);

  // Keep refs in sync
  playingRef.current = playing;
  speedRef.current = playbackSpeed;

  // Fetch replay data once on mount
  useEffect(() => {
    let cancelled = false;

    async function fetchReplay() {
      setLoading(true);
      setError(null);

      const baseUrl = serverUrl || `${window.location.protocol}//${window.location.hostname}:3001`;
      const url = `${baseUrl}/matches/${encodeURIComponent(matchId)}/replay`;

      try {
        const response = await fetch(url);

        if (!response.ok) {
          throw new Error(`Failed to fetch replay: ${response.status} ${response.statusText}`);
        }

        const data = (await response.json()) as ReplayData;

        if (cancelled) return;

        // Ensure events have index numbers
        const events = data.events.map((event, i) => ({
          ...event,
          index: event.index ?? i,
        }));

        setReplayData({ ...data, events });
        setCurrentIndex(0);
      } catch (err) {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : 'Failed to load replay');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    fetchReplay();

    return () => {
      cancelled = true;
    };
  }, [matchId, serverUrl]);

  // Compute derived values
  const events = replayData?.events ?? [];
  const totalEvents = events.length;
  const currentEvent = totalEvents > 0 && currentIndex < totalEvents ? events[currentIndex] : null;
  const progress = totalEvents > 1 ? currentIndex / (totalEvents - 1) : 0;

  // Compute phase transition indices
  const phaseTransitions = events.reduce<number[]>((acc, event, i) => {
    if (event.type === 'phase_transition') {
      acc.push(i);
    }
    return acc;
  }, []);

  // Auto-advance playback
  useEffect(() => {
    if (!playing || totalEvents === 0) {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = undefined;
      }
      return;
    }

    intervalRef.current = setInterval(() => {
      setCurrentIndex((prev) => {
        const next = prev + 1;
        if (next >= totalEvents) {
          setPlaying(false);
          return prev;
        }
        return next;
      });
    }, BASE_INTERVAL_MS / speedRef.current);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = undefined;
      }
    };
  }, [playing, totalEvents, playbackSpeed]);

  // Controls
  const seek = useCallback(
    (index: number) => {
      const clamped = Math.max(0, Math.min(index, totalEvents - 1));
      setCurrentIndex(clamped);
    },
    [totalEvents],
  );

  const seekToTime = useCallback(
    (timestamp: string) => {
      const target = new Date(timestamp).getTime();
      // Find the closest event at or before the target time
      let bestIndex = 0;
      for (let i = 0; i < events.length; i++) {
        const eventTime = new Date(events[i].timestamp).getTime();
        if (eventTime <= target) {
          bestIndex = i;
        } else {
          break;
        }
      }
      setCurrentIndex(bestIndex);
    },
    [events],
  );

  const togglePlay = useCallback(() => {
    setPlaying((prev) => {
      // If at the end, restart from beginning
      if (!prev && currentIndex >= totalEvents - 1) {
        setCurrentIndex(0);
      }
      return !prev;
    });
  }, [currentIndex, totalEvents]);

  const setPlaybackSpeed = useCallback((speed: number) => {
    if (PLAYBACK_SPEEDS.includes(speed)) {
      setPlaybackSpeedState(speed);
    }
  }, []);

  const restart = useCallback(() => {
    setCurrentIndex(0);
    setPlaying(false);
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, []);

  return {
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
    seekToTime,
    togglePlay,
    setPlaybackSpeed,
    restart,
  };
}

export { PLAYBACK_SPEEDS };
