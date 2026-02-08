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
  const urgent = remainingSeconds <= 10;

  return (
    <span
      className={`pill ${isExpired ? 'pink' : urgent ? 'orange' : ''}`}
      style={{
        fontFamily: 'var(--font-body)',
        fontSize: '0.875rem',
        fontWeight: 400,
        color: isExpired
          ? 'var(--accent-pink)'
          : urgent
            ? 'var(--accent-orange)'
            : 'var(--text-primary)',
      }}
    >
      {label && <span style={{ marginRight: '6px', fontWeight: 200 }}>{label}</span>}
      {isExpired ? '0:00' : display}
    </span>
  );
}
