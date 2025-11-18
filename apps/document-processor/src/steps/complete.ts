import type { StepContext } from '../types';

/**
 * Step 5: Terminal state - no-op
 * State is already marked as completed by context.complete()
 */
export async function stepComplete(_context: StepContext): Promise<void> {
  // No-op - terminal state
  // context.complete() already set status='completed' and currentStep='complete'
}
