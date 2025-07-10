import OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod";
import { z } from "zod";

const systemPrompt = `You are an expert assistant for designing and evaluating behavioral interview questions for software engineering roles. Your task is to:

1. Judge if the question is **valid** for a software engineering behavioral or leadership interview (e.g. not vague, not illegal, not off-topic).
2. If valid, generate a list of **relevant principles, values, or traits** the question targets, such as:
   - ownership
   - collaboration
   - communication
   - bias for action
   - problem solving
   - customer obsession
   - learning and growth
   - leadership
   - resilience
   - innovation
   - integrity
   (You can include others if appropriate.)

Respond in JSON format like this:

{
  "is_valid": true,
  "tags": ["ownership", "problem solving"]
}

If the question is invalid, return:

{
  "is_valid": false,
  "tags": []
}`;

const generateUserPrompt = (
  text: string
): string => `Evaluate the following interview question:
"${text}"`;

const TagsResult = z.object({
  is_valid: z.boolean(),
  tags: z.array(z.string()),
});

type TagsResultType = z.infer<typeof TagsResult>;

const nullResult: TagsResultType = {
  is_valid: false,
  tags: [],
};

export const generateTags = async (
  text: string,
  openai: OpenAI
): Promise<TagsResultType> => {
  const userPrompt = generateUserPrompt(text);
  console.log("User prompt:", userPrompt);
  const response = await openai.responses.parse({
    model: "gpt-4o",
    input: [
      {
        role: "system",
        content: systemPrompt,
      },
      {
        role: "user",
        content: userPrompt,
      },
    ],
    text: { format: zodTextFormat(TagsResult, "tagsResult") },
  });

  return response.output_parsed ?? nullResult;
};
