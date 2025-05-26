import { OpenAI } from 'openai';
import pRetry from 'p-retry';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Wrap your OpenAI call inside retry
async function callOpenAIWithRetry(messages: any[]) {
  return await pRetry(
    async () => {
      const response = await openai.chat.completions.create({
        model: 'gpt-4',
        messages,
      });
      return response;
    },
    {
      retries: 5, // Max retries
      factor: 2,  // Exponential backoff factor (2x wait each time)
      minTimeout: 500, // Initial wait (ms)
      maxTimeout: 5000, // Max wait (ms)
      onFailedAttempt: (error) => {
        console.log(`Attempt ${error.attemptNumber} failed. ${error.retriesLeft} retries left.`);
      },
    }
  );
}

if (error.response?.status === 429 || error.response?.status >= 500) {
  throw error; // retry
}
throw new pRetry.AbortError(error); // do not retry