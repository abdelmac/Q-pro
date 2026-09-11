export const APP_PHASES = [
  'role',
  'intro',
  'specialist-choice',
  'quiz',
  'qprofile',
  'student',
  'results',
  'specialist',
  'dashboard',
  'explorer',
  'detail',
  'methodology',
  'comparison',
] as const;

export type AppPhase = (typeof APP_PHASES)[number];

type StaticAppPhase = Exclude<AppPhase, 'quiz' | 'detail'>;

export type AppLocation =
  | { phase: StaticAppPhase }
  | { phase: 'quiz'; stepIndex: number }
  | { phase: 'detail'; specialtyName: string };

export interface AppNavigationConstraints {
  /** Highest valid zero-based questionnaire step. */
  maxQuizStepIndex?: number;
}

export interface AppNavigationState {
  /** The current location is always the final stack entry. */
  stack: AppLocation[];
}

export type AppNavigationAction =
  | { type: 'navigate'; location: unknown }
  | { type: 'replace'; location: unknown }
  | { type: 'back' }
  | { type: 'reset'; location?: unknown };

export const ROOT_APP_LOCATION: AppLocation = Object.freeze({ phase: 'role' });

const APP_PHASE_SET = new Set<string>(APP_PHASES);

export function isAppPhase(value: unknown): value is AppPhase {
  return typeof value === 'string' && APP_PHASE_SET.has(value);
}

function normalizeMaximumQuizStep(value: number | undefined): number {
  if (value === undefined) return Number.MAX_SAFE_INTEGER;
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.trunc(value));
}

/**
 * Converts an unknown location into a safe canonical location.
 * Invalid locations return to the role gate; an invalid detail target falls
 * back to the explorer, and quiz indexes are converted to integers and
 * clamped to the supplied questionnaire bounds.
 */
export function normalizeAppLocation(
  value: unknown,
  constraints: AppNavigationConstraints = {},
): AppLocation {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return ROOT_APP_LOCATION;
  }

  const candidate = value as Record<string, unknown>;
  if (!isAppPhase(candidate.phase)) return ROOT_APP_LOCATION;

  if (candidate.phase === 'quiz') {
    const numericIndex = typeof candidate.stepIndex === 'number' && Number.isFinite(candidate.stepIndex)
      ? Math.trunc(candidate.stepIndex)
      : 0;
    const maximum = normalizeMaximumQuizStep(constraints.maxQuizStepIndex);
    return {
      phase: 'quiz',
      stepIndex: Math.min(maximum, Math.max(0, numericIndex)),
    };
  }

  if (candidate.phase === 'detail') {
    const specialtyName = typeof candidate.specialtyName === 'string'
      ? candidate.specialtyName.trim()
      : '';
    return specialtyName
      ? { phase: 'detail', specialtyName }
      : { phase: 'explorer' };
  }

  return { phase: candidate.phase };
}

export function createAppNavigationState(
  initialLocation: unknown = ROOT_APP_LOCATION,
  constraints: AppNavigationConstraints = {},
): AppNavigationState {
  return { stack: [normalizeAppLocation(initialLocation, constraints)] };
}

export function getCurrentAppLocation(state: AppNavigationState): AppLocation {
  return state.stack[state.stack.length - 1] ?? ROOT_APP_LOCATION;
}

export function getPreviousAppLocation(state: AppNavigationState): AppLocation | null {
  return state.stack.length > 1 ? state.stack[state.stack.length - 2] : null;
}

export function canNavigateBack(state: AppNavigationState): boolean {
  return state.stack.length > 1;
}

export function areAppLocationsEqual(left: AppLocation, right: AppLocation): boolean {
  if (left.phase !== right.phase) return false;
  if (left.phase === 'quiz' && right.phase === 'quiz') {
    return left.stepIndex === right.stepIndex;
  }
  if (left.phase === 'detail' && right.phase === 'detail') {
    return left.specialtyName === right.specialtyName;
  }
  return true;
}

export function createAppNavigationReducer(
  constraints: AppNavigationConstraints = {},
) {
  return function appNavigationReducer(
    state: AppNavigationState,
    action: AppNavigationAction,
  ): AppNavigationState {
    switch (action.type) {
      case 'navigate': {
        const location = normalizeAppLocation(action.location, constraints);
        if (areAppLocationsEqual(getCurrentAppLocation(state), location)) return state;
        return { stack: [...state.stack, location] };
      }

      case 'replace': {
        const location = normalizeAppLocation(action.location, constraints);
        if (areAppLocationsEqual(getCurrentAppLocation(state), location)) return state;
        const remainingStack = state.stack.slice(0, -1);
        const previousLocation = remainingStack[remainingStack.length - 1];
        return previousLocation && areAppLocationsEqual(previousLocation, location)
          ? { stack: remainingStack }
          : { stack: [...remainingStack, location] };
      }

      case 'back':
        return canNavigateBack(state)
          ? { stack: state.stack.slice(0, -1) }
          : state;

      case 'reset':
        return createAppNavigationState(action.location, constraints);
    }
  };
}

export const navigateTo = (location: unknown): AppNavigationAction => ({
  type: 'navigate',
  location,
});

export const navigateBack = (): AppNavigationAction => ({ type: 'back' });

export const replaceNavigation = (location: unknown): AppNavigationAction => ({
  type: 'replace',
  location,
});

export const resetNavigation = (location?: unknown): AppNavigationAction => ({
  type: 'reset',
  location,
});
