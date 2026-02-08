import { Routes, Route } from 'react-router-dom';
import { ErrorBoundary } from './components/ErrorBoundary';
import { LobbyPage } from './pages/LobbyPage';
import { MatchPage } from './pages/MatchPage';
import { ReplayViewer } from './components/ReplayViewer';
import { useParams } from 'react-router-dom';

function ReplayPage() {
  const { id } = useParams<{ id: string }>();
  if (!id) return null;
  return <ReplayViewer matchId={id} />;
}

export function App() {
  return (
    <ErrorBoundary>
      <Routes>
        <Route path="/" element={<LobbyPage />} />
        <Route path="/match/:id" element={<MatchPage />} />
        <Route path="/match/:id/replay" element={<ReplayPage />} />
      </Routes>
    </ErrorBoundary>
  );
}
