import { GlassCard } from './ui/GlassCard';
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
  totalManagers?: number;
  statusText?: string;
  children?: React.ReactNode;
  expanded?: boolean;
  onClick?: () => void;
}

export function ManagerCard({
  manager,
  score,
  rank,
  statusText,
  children,
  expanded = false,
  onClick,
}: ManagerCardProps) {
  return (
    <GlassCard expanded={expanded} onClick={onClick}>
      <div className="manager-card">
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

        <div className="manager-card-body">
          {statusText && !children && (
            <div className="manager-status">{statusText}</div>
          )}
          {children}
        </div>
      </div>
    </GlassCard>
  );
}
