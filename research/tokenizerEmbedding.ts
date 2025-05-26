import { getEncoding } from 'tiktoken'; // Import the tiktoken encoder

// Create a tokenizer for the model you are using (e.g., GPT-3, GPT-4)
const encoder = getEncoding("cl100k_base"); // Adjust encoding for your model

// Define the maximum number of tokens per chunk
const MAX_TOKENS_PER_CHUNK = 1000; // You can adjust this depending on the model's limit (e.g., 4096 for GPT-3/4)

function splitTextIntoChunks(text: string): string[] {
  const tokens = encoder.encode(text); // Tokenize the entire text
  const chunks: string[] = [];
  let chunk = [];

  // Loop over tokens, creating chunks based on MAX_TOKENS_PER_CHUNK
  for (let i = 0; i < tokens.length; i++) {
    chunk.push(tokens[i]);
    if (chunk.length >= MAX_TOKENS_PER_CHUNK || i === tokens.length - 1) {
      // Convert the token chunk back to text and add it to the chunks array
      chunks.push(encoder.decode(chunk));
      chunk = []; // Reset for the next chunk
    }
  }

  return chunks; // Return the array of text chunks
}

// Example usage
const text = `
  This is a large block of text that needs to be chunked based on token limits.
  Depending on the size of the content, it could be split into smaller parts dynamically to ensure no chunk exceeds the model's token capacity.
  This allows for more efficient processing and ensures that the context window is used optimally for large inputs.
`;

const chunks = splitTextIntoChunks(text);
console.log(chunks);

function getTokenLengthOfChunks(text: string): number[] {
  const tokens = encoder.encode(text);
  const tokenChunks: number[] = [];
  let chunk = [];

  for (let i = 0; i < tokens.length; i++) {
    chunk.push(tokens[i]);
    if (chunk.length >= MAX_TOKENS_PER_CHUNK || i === tokens.length - 1) {
      tokenChunks.push(chunk.length);  // Push the length of the chunk in tokens
      chunk = [];
    }
  }

  return tokenChunks; // Returns the number of tokens in each chunk
}

function splitWithOverlap(text: string, overlap: number = 50): string[] {
  const tokens = encoder.encode(text);
  const chunks: string[] = [];
  let chunk: number[] = [];
  let i = 0;

  while (i < tokens.length) {
    // Add tokens to chunk until we hit the max size
    while (chunk.length < MAX_TOKENS_PER_CHUNK && i < tokens.length) {
      chunk.push(tokens[i]);
      i++;
    }

    // Optional: Add an overlap
    if (overlap > 0 && chunk.length > overlap) {
      chunk = chunk.slice(0, chunk.length - overlap);
    }

    // Add the chunk to the result
    chunks.push(encoder.decode(chunk));
    chunk = chunk.slice(chunk.length - overlap); // Keep overlap for next chunk
  }

  return chunks;
}