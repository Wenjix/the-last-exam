import { Routes, Route } from 'react-router-dom';
import { ErrorBoundary } from './components/ErrorBoundary';

export function App() {
  return (
    <ErrorBoundary>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/match/:id" element={<MatchPlaceholder />} />
      </Routes>
    </ErrorBoundary>
  );
}

function Home() {
  return (
    <div style={{ padding: '2rem', fontFamily: 'system-ui' }}>
      <h1>The Last Exam</h1>
      <p>AI coding competition game</p>
    </div>
  );
}

function MatchPlaceholder() {
  return (
    <div style={{ padding: '2rem', fontFamily: 'system-ui' }}>
      <h1>Match View</h1>
      <p>Phase UI components will be wired here.</p>
    </div>
  );
}
