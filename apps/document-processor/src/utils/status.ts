import type { DocumentState, ProcessingStatus } from '../types';

/**
 * Convert DocumentState to ProcessingStatus (public API format)
 */
export function convertStateToStatus(
  state: DocumentState | null | undefined
): ProcessingStatus {
  if (!state) {
    return {
      status: 'not_started',
      currentStep: 'download',
      progress: {
        totalChunks: 0,
        processedChunks: 0,
        percentage: 0,
      },
      errors: [],
      timing: {},
    };
  }

  const timing: {
    startedAt?: string;
    completedAt?: string;
    failedAt?: string;
    duration?: number;
  } = {};

  if (state.startedAt) {
    timing.startedAt = state.startedAt;
  }
  if (state.completedAt) {
    timing.completedAt = state.completedAt;
  }
  if (state.failedAt) {
    timing.failedAt = state.failedAt;
  }
  if (state.completedAt && state.startedAt) {
    timing.duration =
      new Date(state.completedAt).getTime() -
      new Date(state.startedAt).getTime();
  }

  const result: ProcessingStatus = {
    status: state.status,
    currentStep: state.currentStep,
    progress: {
      totalChunks: state.totalChunks,
      processedChunks: state.processedChunks,
      percentage:
        state.totalChunks > 0
          ? Math.round((state.processedChunks / state.totalChunks) * 100)
          : 0,
    },
    errors: state.errors,
    timing,
  };

  if (state.documentId !== undefined) {
    result.documentId = state.documentId;
  }

  return result;
}
