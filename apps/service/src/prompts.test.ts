import { describe, expect, test } from "vitest";
import {
  systemPromptTags,
  developerPromptTagQuestion,
  generateUserPromptTagQuestion,
} from "./prompts";

describe("prompts", () => {
  test("systemPromptTags is a non-empty string containing tag guidance", () => {
    expect(typeof systemPromptTags).toBe("string");
    expect(systemPromptTags.length).toBeGreaterThan(0);
    expect(systemPromptTags).toContain("Tags are defined as a list of strings");
    expect(systemPromptTags).toContain("\n");
  });

  test("developerPromptTagQuestion includes preprocess instructions", () => {
    expect(typeof developerPromptTagQuestion).toBe("string");
    expect(developerPromptTagQuestion.length).toBeGreaterThan(0);
    expect(developerPromptTagQuestion).toContain("You are an expert assistant");
    expect(developerPromptTagQuestion).toContain(
      "Respond in JSON format like this:"
    );
  });

  test("generateUserPromptTagQuestion formats the input question correctly", () => {
    const input = "Tell me about a time you led a team.";
    const expected =
      'Evaluate the following interview question:\n"' + input + '"';
    expect(generateUserPromptTagQuestion(input)).toBe(expected);
  });
});
