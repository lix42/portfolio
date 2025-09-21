import type OpenAI from 'openai';

/**
 * Generates an embedding vector for the given message using the provided OpenAI client.
 *
 * @param message - The input string to generate an embedding for.
 * @param openai - An instance of the OpenAI client.
 * @returns A Promise that resolves to an array of numbers representing the embedding, or null if embedding fails.
 */
export const embed = async (
  message: string,
  openai: OpenAI
): Promise<number[] | null> => {
  const response = await openai.embeddings.create({
    model: 'text-embedding-3-small',
    input: message,
    encoding_format: 'float',
  });

  return response.data[0]?.embedding ?? null;
};
