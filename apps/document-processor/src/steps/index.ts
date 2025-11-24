import type {
  DocumentState,
  ProcessingStep,
  StepHandler,
  StepRegistration,
} from '../types';
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
 * Get next step name, defaulting to 'complete' for last step
 */
function getNextStepName(index: number): ProcessingStep {
  const nextConfig = PROCESSING_STEPS_CONFIG[index + 1];
  return nextConfig ? nextConfig.name : 'complete';
}

/**
 * Build step registry with auto-wired next steps
 * Each step automatically advances to the next in array order
 * Last step transitions to 'complete'
 */
export const PROCESSING_STEPS: StepRegistration[] = [
  ...PROCESSING_STEPS_CONFIG.map((step, index) => ({
    ...step,
    nextStep: getNextStepName(index),
  })),
  {
    name: 'complete',
    handler: stepComplete,
    description: 'Terminal state',
    nextStep: 'complete' as ProcessingStep, // Self-loop
  },
];

/**
 * Build lookup maps for O(1) access
 */
export const STEP_HANDLERS = new Map<DocumentState['currentStep'], StepHandler>(
  PROCESSING_STEPS.map(({ name, handler }) => [name, handler])
);

export const STEP_NEXT = new Map<
  DocumentState['currentStep'],
  DocumentState['currentStep']
>(PROCESSING_STEPS.map(({ name, nextStep }) => [name, nextStep]));
