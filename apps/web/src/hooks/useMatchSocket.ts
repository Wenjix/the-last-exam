import { useEffect, useReducer, useRef, useCallback } from 'react';

// === State Types ===

export type MatchPhase =
  | 'briefing'
  | 'hidden_bid'
  | 'bid_resolve'
  | 'equip'
  | 'run'
  | 'resolve'
  | 'final_standings';

export interface ToolInfo {
  id: string;
  name: string;
  description: string;
}

export interface AuctionResultEntry {
  managerId: string;
  managerName: string;
  amount: number;
  pickOrder: number;
}

export interface MatchUiState {
  connected: boolean;
  matchId: string | null;
  round: number;
  phase: MatchPhase;
  deadline: string | null;
  scores: Record<string, number>;
  commentary: string[];
  challengeTitle: string | null;
  challengeDescription: string | null;
  availableTools: ToolInfo[];
  roundHazard: ToolInfo | null;
  auctionResults: AuctionResultEntry[] | null;
  finalStandings: Array<{
    managerId: string;
    managerName: string;
    totalScore: number;
    rank: number;
    roundScores: number[];
  }> | null;
  lastEvent: Record<string, unknown> | null;
}

// === Actions ===

type MatchAction =
  | { type: 'CONNECTED' }
  | { type: 'DISCONNECTED' }
  | { type: 'JOINED_MATCH'; matchId: string }
  | {
      type: 'PHASE_TRANSITION';
      round: number;
      toPhase: MatchPhase;
      deadline: string | null;
      challengeTitle?: string;
      challengeDescription?: string;
      availableTools?: ToolInfo[];
      roundHazard?: ToolInfo | null;
      auctionResults?: AuctionResultEntry[] | null;
      hazardName?: string;
      hazardDescription?: string;
    }
  | { type: 'ROUND_RESULT'; standings: Record<string, number> }
  | { type: 'COMMENTARY_UPDATE'; text: string }
  | { type: 'FINAL_STANDINGS'; standings: MatchUiState['finalStandings'] }
  | { type: 'RAW_EVENT'; event: Record<string, unknown> };

const initialState: MatchUiState = {
  connected: false,
  matchId: null,
  round: 1,
  phase: 'briefing',
  deadline: null,
  scores: {},
  commentary: [],
  challengeTitle: null,
  challengeDescription: null,
  availableTools: [],
  roundHazard: null,
  auctionResults: null,
  finalStandings: null,
  lastEvent: null,
};

function matchReducer(state: MatchUiState, action: MatchAction): MatchUiState {
  switch (action.type) {
    case 'CONNECTED':
      return { ...state, connected: true };
    case 'DISCONNECTED':
      return { ...state, connected: false };
    case 'JOINED_MATCH':
      return { ...state, matchId: action.matchId };
    case 'PHASE_TRANSITION': {
      // Build hazard from either roundHazard object or hazardName/hazardDescription fields
      let hazard = state.roundHazard;
      if (action.roundHazard) {
        hazard = action.roundHazard;
      } else if (action.hazardName) {
        hazard = {
          id: '',
          name: action.hazardName,
          description: action.hazardDescription ?? '',
        };
      }

      return {
        ...state,
        round: action.round,
        phase: action.toPhase,
        deadline: action.deadline,
        challengeTitle: action.challengeTitle ?? state.challengeTitle,
        challengeDescription: action.challengeDescription ?? state.challengeDescription,
        availableTools: action.availableTools ?? state.availableTools,
        roundHazard: hazard,
        auctionResults: action.auctionResults ?? state.auctionResults,
      };
    }
    case 'ROUND_RESULT':
      return { ...state, scores: action.standings };
    case 'COMMENTARY_UPDATE':
      return { ...state, commentary: [...state.commentary, action.text] };
    case 'FINAL_STANDINGS':
      return { ...state, finalStandings: action.standings, phase: 'final_standings' };
    case 'RAW_EVENT':
      return { ...state, lastEvent: action.event };
    default:
      return state;
  }
}

// === Hook ===

export function useMatchSocket(serverUrl?: string) {
  const [state, dispatch] = useReducer(matchReducer, initialState);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const connect = useCallback(() => {
    const url = serverUrl || `ws://${window.location.hostname}:3001/ws`;

    try {
      const ws = new WebSocket(url);
      wsRef.current = ws;

      ws.onopen = () => dispatch({ type: 'CONNECTED' });

      ws.onclose = () => {
        dispatch({ type: 'DISCONNECTED' });
        // Auto-reconnect after 2s
        reconnectTimer.current = setTimeout(connect, 2000);
      };

      ws.onerror = () => {
        ws.close();
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data as string) as Record<string, unknown>;
          dispatch({ type: 'RAW_EVENT', event: data });

          switch (data.type) {
            case 'connected':
              break;
            case 'joined_match':
              dispatch({ type: 'JOINED_MATCH', matchId: data.matchId as string });
              break;
            case 'phase_transition':
              dispatch({
                type: 'PHASE_TRANSITION',
                round: data.round as number,
                toPhase: data.toPhase as MatchPhase,
                deadline: (data.deadline as string) || null,
                challengeTitle: data.challengeTitle as string | undefined,
                challengeDescription: data.challengeDescription as string | undefined,
                availableTools: data.availableTools as ToolInfo[] | undefined,
                roundHazard: data.roundHazard as ToolInfo | undefined,
                auctionResults: data.auctionResults as AuctionResultEntry[] | undefined,
                hazardName: data.hazardName as string | undefined,
                hazardDescription: data.hazardDescription as string | undefined,
              });
              break;
            case 'round_result':
              dispatch({
                type: 'ROUND_RESULT',
                standings: data.standings as Record<string, number>,
              });
              break;
            case 'commentary_update':
              dispatch({
                type: 'COMMENTARY_UPDATE',
                text: data.text as string,
              });
              break;
            case 'final_standings':
              dispatch({
                type: 'FINAL_STANDINGS',
                standings: data.standings as MatchUiState['finalStandings'],
              });
              break;
          }
        } catch {
          // Invalid JSON — ignore
        }
      };
    } catch {
      reconnectTimer.current = setTimeout(connect, 2000);
    }
  }, [serverUrl]);

  useEffect(() => {
    connect();
    return () => {
      clearTimeout(reconnectTimer.current);
      wsRef.current?.close();
    };
  }, [connect]);

  const joinMatch = useCallback((matchId: string) => {
    wsRef.current?.send(JSON.stringify({ type: 'join_match', matchId }));
  }, []);

  const leaveMatch = useCallback(() => {
    wsRef.current?.send(JSON.stringify({ type: 'leave_match' }));
  }, []);

  return { state, joinMatch, leaveMatch };
}
