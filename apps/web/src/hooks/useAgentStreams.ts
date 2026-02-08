import { useEffect, useReducer, useState, useCallback } from 'react';
import type { MatchUiState } from './useMatchSocket';

// === State Types ===

export interface TestResult {
  testIndex: number;
  passed: boolean;
  errorMessage?: string;
}

export interface AgentStreamState {
  status: 'idle' | 'coding' | 'testing' | 'complete' | 'failed';
  language: string;
  codeBuffer: string;
  lineCount: number;
  testResults: TestResult[];
  totalTests: number;
  testsPassed: number;
  durationMs: number;
}

export interface AgentStreamsMap {
  [managerId: string]: AgentStreamState;
}

// === Actions ===

type StreamAction =
  | { type: 'STREAM_START'; managerId: string; language: string }
  | { type: 'STREAM_CHUNK'; managerId: string; content: string; lineNumber: number }
  | {
      type: 'STREAM_TEST_RESULT';
      managerId: string;
      testIndex: number;
      totalTests: number;
      passed: boolean;
      errorMessage?: string;
    }
  | {
      type: 'STREAM_COMPLETE';
      managerId: string;
      success: boolean;
      totalLines: number;
      testsPassed: number;
      testsTotal: number;
      durationMs: number;
    }
  | { type: 'RESET' };

function createInitialAgentState(): AgentStreamState {
  return {
    status: 'idle',
    language: 'python',
    codeBuffer: '',
    lineCount: 0,
    testResults: [],
    totalTests: 0,
    testsPassed: 0,
    durationMs: 0,
  };
}

function streamsReducer(state: AgentStreamsMap, action: StreamAction): AgentStreamsMap {
  switch (action.type) {
    case 'STREAM_START': {
      const agent = state[action.managerId] ?? createInitialAgentState();
      return {
        ...state,
        [action.managerId]: {
          ...agent,
          status: 'coding',
          language: action.language,
          codeBuffer: '',
          lineCount: 0,
          testResults: [],
          totalTests: 0,
          testsPassed: 0,
          durationMs: 0,
        },
      };
    }
    case 'STREAM_CHUNK': {
      const agent = state[action.managerId];
      if (!agent) return state;
      return {
        ...state,
        [action.managerId]: {
          ...agent,
          codeBuffer: agent.codeBuffer + action.content,
          lineCount: action.lineNumber,
        },
      };
    }
    case 'STREAM_TEST_RESULT': {
      const agent = state[action.managerId];
      if (!agent) return state;
      const newResults = [
        ...agent.testResults,
        {
          testIndex: action.testIndex,
          passed: action.passed,
          errorMessage: action.errorMessage,
        },
      ];
      return {
        ...state,
        [action.managerId]: {
          ...agent,
          status: 'testing',
          testResults: newResults,
          totalTests: action.totalTests,
          testsPassed: newResults.filter((r) => r.passed).length,
        },
      };
    }
    case 'STREAM_COMPLETE': {
      const agent = state[action.managerId];
      if (!agent) return state;
      return {
        ...state,
        [action.managerId]: {
          ...agent,
          status: action.success ? 'complete' : 'failed',
          totalLines: action.totalLines,
          testsPassed: action.testsPassed,
          testsTotal: action.testsTotal,
          durationMs: action.durationMs,
        },
      };
    }
    case 'RESET':
      return {};
    default:
      return state;
  }
}

// === Hook ===

export interface UseAgentStreamsReturn {
  streams: AgentStreamsMap;
  focusedAgent: string | null;
  setFocusedAgent: (id: string | null) => void;
  isQuadMode: boolean;
  toggleQuadMode: () => void;
}

export function useAgentStreams(matchState: MatchUiState): UseAgentStreamsReturn {
  const [streams, dispatch] = useReducer(streamsReducer, {});
  const [focusedAgent, setFocusedAgent] = useState<string | null>(null);
  const [isQuadMode, setIsQuadMode] = useState(true);

  const toggleQuadMode = useCallback(() => {
    setIsQuadMode((prev) => {
      if (prev) return prev; // Already quad, needs click to focus
      setFocusedAgent(null);
      return true;
    });
  }, []);

  // Handle focus — when an agent is focused, exit quad mode
  const handleSetFocusedAgent = useCallback((id: string | null) => {
    setFocusedAgent(id);
    setIsQuadMode(id === null);
  }, []);

  // Reset when leaving execution phase
  useEffect(() => {
    if (matchState.phase !== 'execution' && matchState.phase !== 'scoring') {
      dispatch({ type: 'RESET' });
      setFocusedAgent(null);
      setIsQuadMode(true);
    }
  }, [matchState.phase]);

  // Process streaming events from lastEvent
  useEffect(() => {
    if (!matchState.lastEvent) return;
    const event = matchState.lastEvent;

    switch (event.type) {
      case 'agent_stream_start':
        dispatch({
          type: 'STREAM_START',
          managerId: event.managerId as string,
          language: (event.language as string) || 'python',
        });
        break;
      case 'agent_stream_chunk':
        dispatch({
          type: 'STREAM_CHUNK',
          managerId: event.managerId as string,
          content: event.content as string,
          lineNumber: event.lineNumber as number,
        });
        break;
      case 'agent_stream_test_result':
        dispatch({
          type: 'STREAM_TEST_RESULT',
          managerId: event.managerId as string,
          testIndex: event.testIndex as number,
          totalTests: event.totalTests as number,
          passed: event.passed as boolean,
          errorMessage: event.errorMessage as string | undefined,
        });
        break;
      case 'agent_stream_complete':
        dispatch({
          type: 'STREAM_COMPLETE',
          managerId: event.managerId as string,
          success: event.success as boolean,
          totalLines: event.totalLines as number,
          testsPassed: event.testsPassed as number,
          testsTotal: event.testsTotal as number,
          durationMs: event.durationMs as number,
        });
        break;
    }
  }, [matchState.lastEvent]);

  return {
    streams,
    focusedAgent,
    setFocusedAgent: handleSetFocusedAgent,
    isQuadMode,
    toggleQuadMode,
  };
}
