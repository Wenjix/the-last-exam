interface ProgressBarProps {
  value: number; // 0-1
  color?: string;
  height?: number;
}

export function ProgressBar({ value, color = 'var(--accent-green)', height = 4 }: ProgressBarProps) {
  const clamped = Math.max(0, Math.min(1, value));

  return (
    <div
      className="progress-bar-track"
      style={{
        height: `${height}px`,
        borderRadius: `${height / 2}px`,
        background: 'rgba(255, 255, 255, 0.06)',
        overflow: 'hidden',
      }}
    >
      <div
        className="progress-bar-fill"
        style={{
          width: `${clamped * 100}%`,
          height: '100%',
          background: color,
          borderRadius: `${height / 2}px`,
          transition: 'width 0.3s ease',
        }}
      />
    </div>
  );
}
