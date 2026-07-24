import { useCallback, useReducer } from 'react';

interface HistoryState<T> {
  past: T[];
  present: T;
  future: T[];
}

type Action<T> =
  | { type: 'set'; updater: (prev: T) => T }
  | { type: 'undo' }
  | { type: 'redo' }
  | { type: 'reset'; value: T };

const LIMIT = 100;

function reducer<T>(state: HistoryState<T>, action: Action<T>): HistoryState<T> {
  switch (action.type) {
    case 'set': {
      const value = action.updater(state.present);
      if (value === state.present) return state;
      const past = [...state.past, state.present].slice(-LIMIT);
      return { past, present: value, future: [] };
    }
    case 'undo': {
      if (state.past.length === 0) return state;
      const previous = state.past[state.past.length - 1]!;
      return { past: state.past.slice(0, -1), present: previous, future: [state.present, ...state.future] };
    }
    case 'redo': {
      if (state.future.length === 0) return state;
      const next = state.future[0]!;
      return { past: [...state.past, state.present], present: next, future: state.future.slice(1) };
    }
    case 'reset':
      return { past: [], present: action.value, future: [] };
    default:
      return state;
  }
}

/**
 * Historial deshacer/rehacer genérico para el estado editable de una herramienta.
 * `set` acepta un updater (como setState) y registra un punto de deshacer.
 */
export function useHistory<T>(initial: T) {
  const [state, dispatch] = useReducer(reducer<T>, { past: [], present: initial, future: [] });

  const set = useCallback((updater: T | ((prev: T) => T)) => {
    dispatch({ type: 'set', updater: typeof updater === 'function' ? (updater as (p: T) => T) : () => updater });
  }, []);
  const undo = useCallback(() => dispatch({ type: 'undo' }), []);
  const redo = useCallback(() => dispatch({ type: 'redo' }), []);
  const reset = useCallback((value: T) => dispatch({ type: 'reset', value }), []);

  return {
    state: state.present,
    set,
    undo,
    redo,
    reset,
    canUndo: state.past.length > 0,
    canRedo: state.future.length > 0,
  };
}
