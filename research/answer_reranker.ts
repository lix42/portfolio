import { pipeline } from '@xenova/transformers';

async function reRankChunks(
  userQuery: string,
  retrievedChunks: { content: string }[]
) {
  const ranker = await pipeline(
    'text-classification',
    'cross-encoder/ms-marco-MiniLM-L-6-v2'
  );

  // Prepare pairs
  const pairs = retrievedChunks.map((chunk) => ({
    inputs: {
      text: userQuery,
      text_pair: chunk.content,
    },
  }));

  // Batch scoring
  const scores = await Promise.all(pairs.map((p) => ranker(p.inputs)));

  // Attach scores
  const ranked = retrievedChunks.map((chunk, idx) => ({
    ...chunk,
    score: scores[idx][0].score, // Depending on model output format
  }));

  // Sort by descending score
  ranked.sort((a, b) => b.score - a.score);

  return ranked;
}
