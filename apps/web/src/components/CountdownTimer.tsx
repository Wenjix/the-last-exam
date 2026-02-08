import { useCountdown } from '../hooks/useCountdown';

interface CountdownTimerProps {
  deadline: string | null;
  label?: string;
  onExpired?: () => void;
}

export function CountdownTimer({ deadline, label }: CountdownTimerProps) {
  const { remainingSeconds, isExpired } = useCountdown(deadline);

  if (!deadline) return null;

  const minutes = Math.floor(remainingSeconds / 60);
  const seconds = remainingSeconds % 60;
  const display = `${minutes}:${seconds.toString().padStart(2, '0')}`;

  return (
    <div style={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: '0.5rem',
      padding: '0.25rem 0.75rem',
      borderRadius: '4px',
      backgroundColor: isExpired ? '#fee' : remainingSeconds <= 10 ? '#fff3e0' : '#f5f5f5',
      fontFamily: 'monospace',
      fontSize: '1.25rem',
      fontWeight: 'bold',
      color: isExpired ? '#c00' : remainingSeconds <= 10 ? '#e65100' : '#333',
    }}>
      {label && <span style={{ fontSize: '0.875rem', fontWeight: 'normal' }}>{label}</span>}
      <span>{isExpired ? '0:00' : display}</span>
    </div>
  );
}
