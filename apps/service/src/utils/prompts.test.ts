import { describe, expect, test } from "vitest";

import {
  generateUserPromptAnswerQuestion,
  generateUserPromptProcessQuestion,
} from "./prompts";

describe("prompts", () => {
  test("generateUserPromptProcessQuestion formats the input question correctly", () => {
    const input = "Tell me about a time you led a team.";
    const expected = `Evaluate the following interview question:\n"${input}"`;
    expect(generateUserPromptProcessQuestion(input)).toBe(expected);
  });

  test("generateUserPromptAnswerQuestion formats context and question correctly", () => {
    const context = [
      "Li Xu worked on a React application",
      "Implemented performance optimizations",
    ];
    const question = "What technical contributions did Li make?";
    const result = generateUserPromptAnswerQuestion(context, question);

    expect(result).toContain(
      "Answer the following question based on the provided context:",
    );
    expect(result).toContain("Context:");
    expect(result).toContain("Li Xu worked on a React application");
    expect(result).toContain("Implemented performance optimizations");
    expect(result).toContain("Question:");
    expect(result).toContain("What technical contributions did Li make?");
    expect(result).toContain('"""');
  });

  test("generateUserPromptAnswerQuestion handles empty context array", () => {
    const context: string[] = [];
    const question = "What did Li work on?";
    const result = generateUserPromptAnswerQuestion(context, question);

    expect(result).toContain(
      "Answer the following question based on the provided context:",
    );
    expect(result).toContain("Context:");
    expect(result).toContain("Question:");
    expect(result).toContain("What did Li work on?");
    // Should still have the triple quotes even with empty context
    expect(result).toContain('"""');
  });

  test("generateUserPromptAnswerQuestion handles single context item", () => {
    const context = ["Single context item"];
    const question = "Test question";
    const result = generateUserPromptAnswerQuestion(context, question);

    expect(result).toContain("Single context item");
    expect(result).toContain("Test question");
  });

  test("generateUserPromptAnswerQuestion handles special characters in context and question", () => {
    const context = [
      "Context with \"quotes\" and 'apostrophes'",
      "Context with\nnewlines and\ttabs",
    ];
    const question = "Question with \"quotes\" and 'apostrophes'?";
    const result = generateUserPromptAnswerQuestion(context, question);

    expect(result).toContain("Context with \"quotes\" and 'apostrophes'");
    expect(result).toContain("Context with\nnewlines and\ttabs");
    expect(result).toContain("Question with \"quotes\" and 'apostrophes'?");
  });

  test("generateUserPromptProcessQuestion handles special characters in input", () => {
    const input = 'Tell me about a time you dealt with "difficult" situations?';
    const expected = `Evaluate the following interview question:\n"${input}"`;
    expect(generateUserPromptProcessQuestion(input)).toBe(expected);
  });

  test("generateUserPromptProcessQuestion handles empty string input", () => {
    const input = "";
    const expected = 'Evaluate the following interview question:\n""';
    expect(generateUserPromptProcessQuestion(input)).toBe(expected);
  });
});
