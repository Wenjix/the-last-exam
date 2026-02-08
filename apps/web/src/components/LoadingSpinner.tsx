interface LoadingSpinnerProps {
  message?: string;
}

export function LoadingSpinner({ message }: LoadingSpinnerProps) {
  return (
    <div style={{ padding: '2rem', textAlign: 'center' }}>
      <div style={{
        display: 'inline-block',
        width: '2rem',
        height: '2rem',
        border: '3px solid #eee',
        borderTop: '3px solid #333',
        borderRadius: '50%',
        animation: 'spin 1s linear infinite',
      }} />
      {message && <p style={{ marginTop: '1rem', color: '#666' }}>{message}</p>}
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
