export function LoadingDots({ className = '' }: { className?: string }) {
  return (
    <span className={className} style={{ display: 'inline-flex', gap: '4px', alignItems: 'center' }}>
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          style={{
            width: '6px',
            height: '6px',
            borderRadius: '50%',
            backgroundColor: 'var(--accent-pink)',
            animation: `loading-dots 1.4s infinite both`,
            animationDelay: `${i * 0.2}s`,
          }}
        />
      ))}
    </span>
  );
}
