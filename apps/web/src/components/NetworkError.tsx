interface NetworkErrorProps {
  message?: string;
  onRetry?: () => void;
}

export function NetworkError({ message, onRetry }: NetworkErrorProps) {
  return (
    <div style={{ padding: '2rem', textAlign: 'center' }}>
      <h3>Connection Error</h3>
      <p style={{ color: '#666' }}>{message || 'Unable to connect to the server.'}</p>
      {onRetry && <button onClick={onRetry}>Retry</button>}
    </div>
  );
}
