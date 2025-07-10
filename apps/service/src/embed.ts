import OpenAI from "openai";

export const embed = async (
  message: string,
  openai: OpenAI
): Promise<number[] | null> => {
  const response = await openai.embeddings.create({
    model: "text-embedding-3-small",
    input: message,
    encoding_format: "float",
  });

  return response.data[0]?.embedding ?? null;
};
