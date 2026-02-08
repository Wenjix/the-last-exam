import { useRef, useEffect } from 'react';
import { GlassCard } from './ui/GlassCard';
import './BattleLog.css';

export interface BattleLogEntry {
  id: string;
  type: 'system' | 'phase_transition' | 'bid' | 'score' | 'commentary' | 'run' | 'error';
  text: string;
  timestamp: string;
}

interface BattleLogProps {
  entries: BattleLogEntry[];
}

function formatTime(ts: string): string {
  try {
    return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  } catch {
    return '';
  }
}

export function BattleLog({ entries }: BattleLogProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [entries.length]);

  return (
    <GlassCard className="battlelog-wrapper" style={{ height: '100%' }}>
      <div className="battlelog">
        <div className="battlelog-title">battle log</div>
        <div ref={scrollRef} className="battlelog-messages">
          {entries.map((entry) => (
            <div key={entry.id} className={`battlelog-msg ${entry.type}`}>
              <span className="msg-time">{formatTime(entry.timestamp)}</span>
              {entry.text}
            </div>
          ))}
          {entries.length === 0 && (
            <div className="battlelog-msg system">waiting for match events...</div>
          )}
        </div>
      </div>
    </GlassCard>
  );
}
