export interface TaskHealthState {
  lastAttemptAt: string | null;
  lastSuccessAt: string | null;
  lastError: string | null;
}

export type ServiceHealthStatus = 'starting' | 'healthy' | 'degraded';

export function createTaskHealthState(): TaskHealthState {
  return {
    lastAttemptAt: null,
    lastSuccessAt: null,
    lastError: null,
  };
}

export function recordTaskSuccess(
  state: TaskHealthState,
  completedAt: Date
): void {
  const timestamp = completedAt.toISOString();
  state.lastAttemptAt = timestamp;
  state.lastSuccessAt = timestamp;
  state.lastError = null;
}

export function recordTaskFailure(
  state: TaskHealthState,
  completedAt: Date,
  error: unknown
): void {
  state.lastAttemptAt = completedAt.toISOString();
  state.lastError = error instanceof Error ? error.message : String(error);
}

export function evaluateServiceHealth(
  requiredTasks: readonly TaskHealthState[]
): ServiceHealthStatus {
  if (requiredTasks.some((state) => state.lastAttemptAt === null)) {
    return 'starting';
  }

  if (requiredTasks.some((state) => state.lastError !== null)) {
    return 'degraded';
  }

  return 'healthy';
}
