import type { StepContext } from '../types';
import {
  getOrCreateCompany,
  insertIntoD1,
  insertIntoVectorize,
} from '../utils';

/**
 * Step 4: Store to D1 and Vectorize (two-phase commit)
 * Retrieves all chunks from storage and stores to external databases
 */
export async function stepStoreToD1AndVectorize(
  context: StepContext
): Promise<void> {
  console.log(`[${context.state.r2Key}] Step 4: Store to D1 and Vectorize`);

  if (!context.state.metadata) {
    throw new Error('Metadata missing');
  }

  // Get all chunks from storage
  const chunks = await context.chunks.getAllChunks();

  if (chunks.length === 0) {
    throw new Error('No chunks found in storage');
  }

  // Phase 1: Insert into Vectorize (idempotent)
  await insertIntoVectorize(context.state, chunks, context.env.VECTORIZE);

  // Phase 2: Insert into D1 (transactional)
  const documentId = await insertIntoD1(
    context.state,
    chunks,
    context.env.DB,
    getOrCreateCompany
  );

  // Update state
  context.state.documentId = documentId;

  // Advance to next step (complete)
  await context.next();
}
