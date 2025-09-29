import { ChromaClient } from 'chromadb';
import { RecursiveCharacterTextSplitter } from 'langchain/text_splitter';
import { OpenAI } from 'openai';

// Setup OpenAI and Chroma clients
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const chroma = new ChromaClient();
const collection = await chroma.getOrCreateCollection({ name: 'docs-code' });

/**
 * Embeds a list of texts into vectors using OpenAI Embeddings API.
 *
 * @param texts - Array of strings to embed
 * @returns Promise<number[][]> - Array of vector embeddings
 *
 * Example input:
 *   ["How to connect database?", "Error handling retries"]
 *
 * Example output:
 *   [[0.123, -0.532, ...], [0.643, 0.221, ...]]  // Array of 1536-dim vectors
 */
async function embedTexts(texts: string[]): Promise<number[][]> {
  const response = await openai.embeddings.create({
    model: 'text-embedding-ada-002',
    input: texts,
  });
  return response.data.map((d) => d.embedding);
}

/**
 * Splits a long text into smaller overlapping chunks for better context handling.
 *
 * @param text - Input document or code as a single string
 * @returns Promise<string[]> - Array of text chunks
 *
 * Example input:
 *   "function A() {...} function B() {...} function C() {...}"
 *
 * Example output:
 *   ["function A() {...}", "function B() {...}", "function C() {...}"]
 */
async function chunkText(text: string): Promise<string[]> {
  const splitter = new RecursiveCharacterTextSplitter({
    chunkSize: 500,
    chunkOverlap: 50,
  });
  return await splitter.splitText(text);
}

/**
 * Indexes documents by splitting them into chunks, embedding them,
 * and storing them into ChromaDB collection.
 *
 * @param documents - Array of { id: string, text: string }
 *
 * Example input:
 *   [
 *     { id: 'auth', text: 'function login(user) {...}' },
 *     { id: 'db', text: 'class Database {...}' }
 *   ]
 *
 * Effect:
 *   Stores chunks with embeddings into vector DB for retrieval later.
 */
async function indexDocuments(documents: { id: string; text: string }[]) {
  for (const doc of documents) {
    const chunks = await chunkText(doc.text);
    const chunkEmbeddings = await embedTexts(chunks);

    const chunkIds = chunks.map((_, idx) => `${doc.id}_chunk${idx}`);

    await collection.add({
      ids: chunkIds,
      embeddings: chunkEmbeddings,
      documents: chunks,
      metadatas: chunks.map(() => ({ sourceDoc: doc.id })),
    });
  }
}

/**
 * Answers a user question based on indexed document knowledge.
 * Retrieves relevant chunks and queries ChatGPT with them.
 *
 * @param question - User's natural language question
 *
 * Example input:
 *   "How is error handling done?"
 *
 * Example output (console):
 *   "Error handling retries network requests automatically."
 */
async function answerQuestion(question: string) {
  try {
    const questionEmbedding = await embedTexts([question]);
    const searchResults = await collection.query({
      queryEmbeddings: questionEmbedding,
      nResults: 5,
    });

    const contextChunks = searchResults.documents.flat();

    if (!contextChunks.length) {
      console.log("No relevant documents found.");
      return;
    }

    const systemPrompt = `
You are a highly skilled coding assistant. Use the following context to answer:

${contextChunks.join('\n\n')}

If the answer is not in the context, reply: "I don't know based on the provided documents."
`;

    const chatResponse = await openai.chat.completions.create({
      model: 'gpt-4',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: question },
      ],
      temperature: 0,
    });

    console.log('Answer:', chatResponse.choices[0].message?.content);
  } catch (err) {
    console.error('Error answering question:', err);
  }
}

// --- Example usage ---
(async () => {
  // Uncomment this first time to index documents
  /*
  await indexDocuments([
    { id: 'auth', text: 'function login(user) { /* login logic */ }' },
    { id: 'error', text: 'try { /* network request */ } catch (e) { /* retry */ }' },
    { id: 'db', text: 'class DatabasePool { /* pooling logic */ }' },
  ]);
  */

  await answerQuestion('How is database connection pooling handled?');
})();