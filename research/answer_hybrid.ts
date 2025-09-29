import * as faiss from 'faiss';
import Fuse from 'fuse.js';

// Define the search configuration
const fuseOptions = {
  includeScore: true,
  threshold: 0.3, // Adjust based on your needs
  keys: ['text'],
};

// Simulated document data for keyword search
const documents = [
  {
    text: 'Database connection pooling in Node.js improves performance by reusing connections.',
  },
  {
    text: 'Using indexes in SQL queries can significantly speed up data retrieval.',
  },
  {
    text: 'Query caching stores results of frequent queries to reduce processing time.',
  },
  // Add more documents here...
];

// Define a method to perform semantic search using embeddings (vector-based)
async function semanticSearch(queryEmbedding: number[], topK: number) {
  const faissIndex = await faiss.readIndex('path_to_index');
  const results = faissIndex.search(queryEmbedding, topK);
  return results;
}

// Define a method for keyword-based fuzzy search
function keywordSearch(query: string, topK: number) {
  const fuse = new Fuse(documents, fuseOptions);
  const results = fuse.search(query);
  return results.slice(0, topK).map((result) => ({
    text: result.item.text,
    score: result.score ?? 0,
  }));
}

// Combine both semantic and keyword search
async function hybridSearch(
  query: string,
  queryEmbedding: number[],
  topK: number
) {
  // Perform semantic search
  const semanticResults = await semanticSearch(queryEmbedding, topK);

  // Perform keyword-based fuzzy search
  const keywordResults = keywordSearch(query, topK);

  // Combine and rank results based on both semantic and keyword relevance
  const allResults = [
    ...semanticResults.map((r) => ({
      text: r.document,
      score: r.score,
      source: 'semantic',
    })),
    ...keywordResults.map((r) => ({
      text: r.text,
      score: r.score,
      source: 'keyword',
    })),
  ];

  // Rank results based on combined score (e.g., add semantic and keyword score)
  allResults.sort((a, b) => b.score - a.score);

  // Return the top results after sorting by relevance
  return allResults.slice(0, topK);
}

// Example usage:
async function getAnswerWithHybridSearch(
  question: string,
  questionEmbedding: number[]
) {
  const topK = 5; // Number of top results to return
  const results = await hybridSearch(question, questionEmbedding, topK);

  // Use these results to format your final answer
  console.log('Hybrid Search Results:', results);
}
