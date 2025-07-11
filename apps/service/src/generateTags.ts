import OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod";
import { z } from "zod";
import {
  generateUserPromptTagQuestion,
  systemPromptTags,
  developerPromptTagQuestion,
} from "./prompts";

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
  const userPrompt = generateUserPromptTagQuestion(text);
  const response = await openai.responses.parse({
    model: "gpt-4o",
    input: [
      {
        role: "system",
        content: systemPromptTags,
      },
      {
        role: "developer",
        content: developerPromptTagQuestion,
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
