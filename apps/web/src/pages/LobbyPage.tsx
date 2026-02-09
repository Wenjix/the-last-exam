import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { getApiBaseUrl } from '../lib/api';
import { GlassCard } from '../components/ui/GlassCard';
import { DecryptedText } from '../components/ui/DecryptedText';
import { IridescenceBackground } from '../components/ui/IridescenceBackground';
import { LoadingDots } from '../components/ui/LoadingDots';
import './LobbyPage.css';

export function LobbyPage() {
  const navigate = useNavigate();
  const [playerName, setPlayerName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [geminiApiKey, setGeminiApiKey] = useState('');

  const handleStart = useCallback(async () => {
    const name = playerName.trim() || 'player';
    setLoading(true);
    setError(null);

    try {
      const body: Record<string, unknown> = {
        managers: [
          { name, role: 'human' },
          { name: 'Cult of S.A.M.', role: 'bot' },
          { name: 'iClaudius', role: 'bot' },
          { name: 'Star3.14', role: 'bot' },
        ],
      };

      const trimmedKey = geminiApiKey.trim();
      if (trimmedKey) {
        body.geminiApiKey = trimmedKey;
      }

      const response = await fetch(`${getApiBaseUrl()}/matches`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error((data as { error?: { message?: string } }).error?.message || `server error: ${response.status}`);
      }

      const match = await response.json() as { id: string };
      navigate(`/match/${match.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'failed to create match');
    } finally {
      setLoading(false);
    }
  }, [playerName, geminiApiKey, navigate]);

  return (
    <div className="lobby-page">
      <IridescenceBackground />
      <div className="lobby-content">
        <GlassCard>
          <div className="lobby-inner">
            <div className="lobby-title">
              <DecryptedText text="the last exam" speed={60} />
            </div>
            <p className="lobby-subtitle">
              ai coding competition — manage your agent, bid for data, outcode rivals
            </p>

            <div className="lobby-form">
              <input
                type="text"
                placeholder="your name"
                value={playerName}
                onChange={(e) => setPlayerName(e.target.value)}
                className="glass-input"
                style={{ textAlign: 'center' }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleStart();
                }}
                disabled={loading}
              />
              <button
                onClick={handleStart}
                disabled={loading}
                className="glass-button primary"
              >
                {loading ? <LoadingDots /> : 'start match'}
              </button>
            </div>

            <div className="advanced-section">
              <div className="api-key-row">
                <label className="advanced-label">mistral api key</label>
                <input
                  type="password"
                  value="provided by sponsor"
                  className="glass-input"
                  style={{ textAlign: 'center', fontSize: '0.8125rem' }}
                  disabled
                />
                <p className="advanced-hint">
                  <span className="sponsor-badge">powered by Mistral AI sponsor credits</span>
                  <br />
                  <span className="sponsor-badge">Mistral AI スポンサー提供</span>
                </p>
              </div>

              <div className="api-key-row">
                <label className="advanced-label">gemini api key</label>
                <input
                  type="password"
                  placeholder="AIza..."
                  value={geminiApiKey}
                  onChange={(e) => setGeminiApiKey(e.target.value)}
                  className="glass-input"
                  style={{ textAlign: 'center', fontSize: '0.8125rem' }}
                  disabled={loading}
                />
                <p className="advanced-hint">
                  {geminiApiKey.trim()
                    ? 'live AI commentary + TTS enabled / AIリアルタイム実況+音声読み上げ有効'
                    : 'no key = template-based commentary (demo mode) / キーなし=テンプレ実況（デモモード）'}
                </p>
              </div>
            </div>

            {error && <p className="lobby-error">{error}</p>}
          </div>
        </GlassCard>
      </div>
    </div>
  );
}
