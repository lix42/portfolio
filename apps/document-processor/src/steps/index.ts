import type { ProcessingState, StepHandler, StepRegistration } from '../types';
import { stepComplete } from './complete';
import { stepDownloadAndChunk } from './download-and-chunk';
import { stepGenerateEmbeddingsBatch } from './generate-embeddings';
import { stepGenerateTagsBatch } from './generate-tags';
import { stepStoreToD1AndVectorize } from './store-to-databases';

/**
 * Registry of all processing steps
 * Order matters - determines execution sequence
 * The 'complete' step is automatically appended
 */
const PROCESSING_STEPS_CONFIG: Omit<StepRegistration, 'nextStep'>[] = [
  {
    name: 'download',
    handler: stepDownloadAndChunk,
    description: 'Download from R2 and chunk markdown',
  },
  {
    name: 'embeddings',
    handler: stepGenerateEmbeddingsBatch,
    description: 'Generate embeddings for chunks (batched)',
  },
  {
    name: 'tags',
    handler: stepGenerateTagsBatch,
    description: 'Generate tags for chunks (batched)',
  },
  {
    name: 'store',
    handler: stepStoreToD1AndVectorize,
    description: 'Store to D1 and Vectorize (two-phase commit)',
  },
];

/**
 * Build step registry with auto-wired next steps
 * Each step automatically advances to the next in array order
 * Last step transitions to 'complete'
 */
export const PROCESSING_STEPS: StepRegistration[] = [
  ...PROCESSING_STEPS_CONFIG.map((step, index) => ({
    ...step,
    nextStep:
      index < PROCESSING_STEPS_CONFIG.length - 1
        ? PROCESSING_STEPS_CONFIG[index + 1]!.name
        : 'complete',
  })),
  {
    name: 'complete',
    handler: stepComplete,
    description: 'Terminal state',
    nextStep: 'complete', // Self-loop
  },
];

/**
 * Build lookup maps for O(1) access
 */
export const STEP_HANDLERS = new Map<
  ProcessingState['currentStep'],
  StepHandler
>(PROCESSING_STEPS.map(({ name, handler }) => [name, handler]));

export const STEP_NEXT = new Map<
  ProcessingState['currentStep'],
  ProcessingState['currentStep']
>(PROCESSING_STEPS.map(({ name, nextStep }) => [name, nextStep]));
