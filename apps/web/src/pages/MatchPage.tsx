import { useEffect, useState, useCallback, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { useMatchSocket } from '../hooks/useMatchSocket';
import type { MatchPhase } from '../hooks/useMatchSocket';
import { useAudioPlayer } from '../hooks/useAudioPlayer';
import { MatchLayout } from '../components/layout/MatchLayout';
import { Header } from '../components/layout/Header';
import { IridescenceBackground } from '../components/ui/IridescenceBackground';
import { LoadingDots } from '../components/ui/LoadingDots';
import { ManagerCard } from '../components/ManagerCard';
import { BattleLog } from '../components/BattleLog';
import type { BattleLogEntry } from '../components/BattleLog';
import { BudgetBidForm } from '../components/BudgetBidForm';
import { StrategyForm } from '../components/StrategyForm';
import { CountdownTimer } from '../components/CountdownTimer';
import { AudioPlayer } from '../components/AudioPlayer';
import { LanguageSelector } from '../components/LanguageSelector';
import { BriefingPhase } from '../components/phases/BriefingPhase';
import { BiddingPhase } from '../components/phases/BiddingPhase';
import { StrategyPhase } from '../components/phases/StrategyPhase';
import { RunPhase } from '../components/phases/RunPhase';
import { ScoringPhase } from '../components/phases/ScoringPhase';
import { FinalStandingsPhase } from '../components/phases/FinalStandingsPhase';
import './MatchPage.css';

interface ManagerInfo {
  id: string;
  name: string;
  role: 'human' | 'bot';
}

export function MatchPage() {
  const { id: matchId } = useParams<{ id: string }>();
  const { state, joinMatch } = useMatchSocket();
  const audioPlayer = useAudioPlayer();
  const [language, setLanguage] = useState<'en' | 'fr' | 'ja'>('en');
  const [managers, setManagers] = useState<ManagerInfo[]>([]);
  const [logEntries, setLogEntries] = useState<BattleLogEntry[]>([]);
  const logIdCounter = useRef(0);
  const [matchLoaded, setMatchLoaded] = useState(false);

  // Fetch match data and join WebSocket
  useEffect(() => {
    if (!matchId) return;

    async function loadMatch() {
      try {
        const res = await fetch(`/matches/${matchId}`);
        if (res.ok) {
          const data = await res.json() as { managers: ManagerInfo[] };
          setManagers(data.managers);
          setMatchLoaded(true);
        }
      } catch {
        // Will show error state
      }
    }

    loadMatch();
  }, [matchId]);

  // Join match once connected
  useEffect(() => {
    if (state.connected && matchId) {
      joinMatch(matchId);
    }
  }, [state.connected, matchId, joinMatch]);

  // Feed events to battle log
  useEffect(() => {
    if (!state.lastEvent) return;
    const event = state.lastEvent;
    const type = event.type as string;

    let logType: BattleLogEntry['type'] = 'system';
    let text = '';

    switch (type) {
      case 'phase_transition': {
        logType = 'phase_transition';
        const toPhase = event.toPhase as string;
        if (toPhase === 'briefing' && event.challengeTitle) {
          text = `round ${event.round}: ${event.challengeTitle}`;
        } else if (toPhase === 'strategy' && event.bidWinner) {
          const winner = event.bidWinner as { managerName: string; amount: number };
          text = `${winner.managerName} won data card for ${winner.amount} pts`;
        } else {
          text = `phase: ${toPhase} (round ${event.round})`;
        }
        break;
      }
      case 'commentary_update':
        logType = 'commentary';
        text = event.text as string;
        audioPlayer.enqueue({
          id: `commentary-${logIdCounter.current}`,
          audioData: null,
          text: event.text as string,
        });
        break;
      case 'round_result':
        logType = 'score';
        text = `round ${event.round} complete`;
        break;
      case 'bid_submitted':
        logType = 'bid';
        text = `bid received`;
        break;
      case 'strategy_submitted':
        logType = 'system';
        text = `strategy submitted`;
        break;
      case 'final_standings':
        logType = 'system';
        text = `match complete — final standings`;
        break;
      default:
        return; // Skip non-game events
    }

    if (text) {
      logIdCounter.current++;
      setLogEntries((prev) => [...prev, {
        id: String(logIdCounter.current),
        type: logType,
        text,
        timestamp: new Date().toISOString(),
      }]);
    }
  }, [state.lastEvent]);

  // Submit bid
  const handleSubmitBid = useCallback(async (amount: number) => {
    if (!matchId) return;
    const humanManager = managers.find((m) => m.role === 'human');
    if (!humanManager) return;

    const res = await fetch(`/matches/${matchId}/bids`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        managerId: humanManager.id,
        round: state.round,
        amount,
      }),
    });

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error((data as { error?: { message?: string } }).error?.message || 'bid failed');
    }
  }, [matchId, managers, state.round]);

  // Submit strategy
  const handleSubmitStrategy = useCallback(async (prompt: string) => {
    if (!matchId) return;
    const humanManager = managers.find((m) => m.role === 'human');
    if (!humanManager) return;

    const res = await fetch(`/matches/${matchId}/strategy`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        managerId: humanManager.id,
        round: state.round,
        prompt,
      }),
    });

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error((data as { error?: { message?: string } }).error?.message || 'strategy failed');
    }
  }, [matchId, managers, state.round]);

  // Compute ranks from scores
  const sortedByScore = [...managers].sort(
    (a, b) => (state.scores[b.id] ?? 0) - (state.scores[a.id] ?? 0)
  );
  const ranks: Record<string, number> = {};
  sortedByScore.forEach((m, i) => { ranks[m.id] = i + 1; });

  // Status text per phase
  function getManagerStatus(manager: ManagerInfo, phase: MatchPhase): string {
    if (manager.role === 'bot') {
      switch (phase) {
        case 'bidding': return 'considering...';
        case 'strategy': return 'crafting strategy...';
        case 'execution': return 'solving...';
        default: return 'waiting';
      }
    }
    switch (phase) {
      case 'briefing': return 'reviewing challenge';
      case 'bidding': return 'place your bid below';
      case 'strategy': return 'write agent instructions';
      case 'execution': return 'agent running...';
      case 'scoring': return 'viewing results';
      default: return 'waiting';
    }
  }

  // Loading state
  if (!matchLoaded || !matchId) {
    return (
      <div className="match-page-loading">
        <IridescenceBackground />
        <div className="loading-inner">
          <LoadingDots />
          <p style={{ color: 'var(--text-muted)', fontSize: '0.8125rem', marginTop: '1rem' }}>
            {!state.connected ? 'connecting...' : 'loading match...'}
          </p>
        </div>
      </div>
    );
  }

  // Phase panel content
  function renderPhasePanel() {
    switch (state.phase) {
      case 'briefing':
        return (
          <BriefingPhase
            round={state.round}
            challengeTitle={state.challengeTitle ?? undefined}
            challengeDescription={state.challengeDescription ?? undefined}
            dataCardTitle={state.dataCard?.title}
            dataCardDescription={state.dataCard?.description}
          />
        );
      case 'bidding':
        return (
          <BiddingPhase
            round={state.round}
            dataCardTitle={state.dataCard?.title}
            dataCardDescription={state.dataCard?.description}
            budgets={state.budgets}
          />
        );
      case 'strategy':
        return (
          <StrategyPhase
            round={state.round}
            bidWinner={state.bidWinner}
          />
        );
      case 'execution':
        return <RunPhase round={state.round} />;
      case 'scoring':
        return <ScoringPhase round={state.round} standings={state.scores} />;
      case 'final_standings':
        return null; // Rendered as overlay
      default:
        return null;
    }
  }

  // Render manager card content for human manager
  function renderHumanContent(manager: ManagerInfo) {
    if (state.phase === 'bidding') {
      return (
        <BudgetBidForm
          matchId={matchId!}
          managerId={manager.id}
          round={state.round}
          remainingBudget={state.budgets[manager.id] ?? 100}
          onSubmit={handleSubmitBid}
        />
      );
    }
    if (state.phase === 'strategy') {
      return (
        <StrategyForm
          matchId={matchId!}
          managerId={manager.id}
          round={state.round}
          onSubmit={handleSubmitStrategy}
        />
      );
    }
    return null;
  }

  const humanManager = managers.find((m) => m.role === 'human');

  return (
    <>
      <MatchLayout
        background={<IridescenceBackground />}
        header={
          <Header
            round={state.round}
            phase={state.phase}
            languageSelector={<LanguageSelector value={language} onChange={setLanguage} />}
            audioControls={
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                {state.deadline && <CountdownTimer deadline={state.deadline} />}
                <AudioPlayer {...audioPlayer} />
              </div>
            }
          />
        }
        managerCards={managers.map((manager) => (
          <ManagerCard
            key={manager.id}
            manager={manager}
            score={state.scores[manager.id] ?? 0}
            rank={ranks[manager.id]}
            budget={state.budgets[manager.id]}
            statusText={getManagerStatus(manager, state.phase)}
          >
            {manager.role === 'human' && humanManager ? renderHumanContent(manager) : null}
          </ManagerCard>
        ))}
        battleLog={<BattleLog entries={logEntries} />}
        phasePanel={
          <div className="phase-panel" key={`${state.phase}-${state.round}`}>
            {renderPhasePanel()}
          </div>
        }
      />

      {/* Final standings overlay */}
      {state.phase === 'final_standings' && state.finalStandings && (
        <FinalStandingsPhase standings={state.finalStandings} />
      )}

      {/* Commentary text bar */}
      {audioPlayer.currentText && (
        <div style={{
          position: 'fixed', bottom: '12px', left: '12px', right: '12px',
          zIndex: 15, animation: 'fade-in 0.3s ease',
        }}>
          <div className="commentary-text">
            {audioPlayer.currentText}
          </div>
        </div>
      )}
    </>
  );
}
