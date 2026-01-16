import { ANSWER_GENERATION_MODEL } from "@portfolio/shared";
import type OpenAI from "openai";
import type {
  ResponseOutputItem,
  ResponseOutputMessage,
} from "openai/resources/responses/responses.mjs";
import { beforeEach, describe, expect, test, vi } from "vitest";

import {
  answerQuestionWithChunks,
  answerQuestionWithWholeDocument,
  extractAssistantAnswer,
} from "./answerQuestion";

// Mock OpenAI
const mockOpenAI = {
  responses: {
    create: vi.fn(),
  },
} as unknown as OpenAI;

describe("answerQuestion", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("answerQuestionWithChunks", () => {
    test("calls OpenAI with correct parameters for chunk-based questions", async () => {
      const mockOutput: ResponseOutputItem[] = [
        {
          type: "message",
          role: "assistant",
          status: "completed",
          content: [
            {
              type: "output_text",
              text: "Based on the provided context, Li Xu worked on React applications.",
            },
          ],
        } as ResponseOutputMessage,
      ];

      vi.mocked(mockOpenAI.responses.create).mockResolvedValue({
        output: mockOutput,
      } as OpenAI.Responses.Response);

      const context = [
        "Li Xu is a senior frontend engineer",
        "He worked on React applications at multiple companies",
      ];
      const question = "What did Li work on?";

      const result = await answerQuestionWithChunks(
        context,
        question,
        mockOpenAI,
      );

      expect(mockOpenAI.responses.create).toHaveBeenCalledWith({
        model: ANSWER_GENERATION_MODEL,
        input: [
          { role: "system", content: expect.stringContaining("You are Li Xu") },
          {
            role: "user",
            content: expect.stringContaining("What did Li work on?"),
          },
        ],
      });

      expect(result).toEqual(mockOutput);
    });

    test("handles empty context array", async () => {
      const mockOutput: ResponseOutputItem[] = [];
      vi.mocked(mockOpenAI.responses.create).mockResolvedValue({
        output: mockOutput,
      } as OpenAI.Responses.Response);

      const context: string[] = [];
      const question = "What did Li work on?";

      const result = await answerQuestionWithChunks(
        context,
        question,
        mockOpenAI,
      );

      expect(mockOpenAI.responses.create).toHaveBeenCalledWith({
        model: ANSWER_GENERATION_MODEL,
        input: [
          { role: "system", content: expect.any(String) },
          {
            role: "user",
            content: expect.stringContaining("What did Li work on?"),
          },
        ],
      });

      expect(result).toEqual(mockOutput);
    });

    test("handles single context item", async () => {
      const mockOutput: ResponseOutputItem[] = [];
      vi.mocked(mockOpenAI.responses.create).mockResolvedValue({
        output: mockOutput,
      } as OpenAI.Responses.Response);

      const context = ["Single context item"];
      const question = "Test question";

      await answerQuestionWithChunks(context, question, mockOpenAI);

      expect(mockOpenAI.responses.create).toHaveBeenCalledWith({
        model: ANSWER_GENERATION_MODEL,
        input: [
          { role: "system", content: expect.any(String) },
          {
            role: "user",
            content: expect.stringContaining("Single context item"),
          },
        ],
      });
    });

    test("propagates OpenAI API errors", async () => {
      const error = new Error("API Error");
      vi.mocked(mockOpenAI.responses.create).mockRejectedValue(error);

      const context = ["Test context"];
      const question = "Test question";

      await expect(
        answerQuestionWithChunks(context, question, mockOpenAI),
      ).rejects.toThrow("API Error");
    });
  });

  describe("answerQuestionWithWholeDocument", () => {
    test("calls OpenAI with correct parameters for document-based questions", async () => {
      const mockOutput: ResponseOutputItem[] = [
        {
          type: "message",
          role: "assistant",
          status: "completed",
          content: [
            {
              type: "output_text",
              text: "Based on the document, Li has extensive React experience.",
            },
          ],
        } as ResponseOutputMessage,
      ];

      vi.mocked(mockOpenAI.responses.create).mockResolvedValue({
        output: mockOutput,
      } as OpenAI.Responses.Response);

      const document =
        "Complete document about Li Xu's work experience and technical contributions";
      const question = "What are Li's technical skills?";

      const result = await answerQuestionWithWholeDocument(
        document,
        question,
        mockOpenAI,
      );

      expect(mockOpenAI.responses.create).toHaveBeenCalledWith({
        model: ANSWER_GENERATION_MODEL,
        input: [
          { role: "system", content: expect.stringContaining("You are Li Xu") },
          {
            role: "user",
            content: expect.stringContaining(
              "Complete document about Li Xu's work experience",
            ),
          },
        ],
      });

      expect(result).toEqual(mockOutput);
    });

    test("handles empty document", async () => {
      const mockOutput: ResponseOutputItem[] = [];
      vi.mocked(mockOpenAI.responses.create).mockResolvedValue({
        output: mockOutput,
      } as OpenAI.Responses.Response);

      const document = "";
      const question = "What did Li work on?";

      await answerQuestionWithWholeDocument(document, question, mockOpenAI);

      expect(mockOpenAI.responses.create).toHaveBeenCalledWith({
        model: ANSWER_GENERATION_MODEL,
        input: [
          { role: "system", content: expect.any(String) },
          { role: "user", content: expect.any(String) },
        ],
      });
    });

    test("handles long documents", async () => {
      const mockOutput: ResponseOutputItem[] = [];
      vi.mocked(mockOpenAI.responses.create).mockResolvedValue({
        output: mockOutput,
      } as OpenAI.Responses.Response);

      const document = "A".repeat(10000);
      const question = "Summarize this document";

      await answerQuestionWithWholeDocument(document, question, mockOpenAI);

      expect(mockOpenAI.responses.create).toHaveBeenCalledWith({
        model: ANSWER_GENERATION_MODEL,
        input: [
          { role: "system", content: expect.any(String) },
          { role: "user", content: expect.stringContaining("A".repeat(100)) },
        ],
      });
    });

    test("propagates OpenAI API errors", async () => {
      const error = new Error("Network Error");
      vi.mocked(mockOpenAI.responses.create).mockRejectedValue(error);

      const document = "Test document";
      const question = "Test question";

      await expect(
        answerQuestionWithWholeDocument(document, question, mockOpenAI),
      ).rejects.toThrow("Network Error");
    });
  });

  describe("extractAssistantAnswer", () => {
    test("extracts text from completed assistant messages", () => {
      const output: ResponseOutputItem[] = [
        {
          type: "message",
          role: "assistant",
          status: "completed",
          content: [
            {
              type: "output_text",
              text: "First response part.",
            },
            {
              type: "output_text",
              text: "Second response part.",
            },
          ],
        } as ResponseOutputMessage,
      ];

      const result = extractAssistantAnswer(output);

      expect(result).toBe("First response part.\n\nSecond response part.");
    });

    test("filters out non-message items", () => {
      const output: ResponseOutputItem[] = [
        {
          type: "function_call",
          id: "call_123",
        } as ResponseOutputItem,
        {
          type: "message",
          role: "assistant",
          status: "completed",
          content: [
            {
              type: "output_text",
              text: "Assistant response.",
            },
          ],
        } as ResponseOutputMessage,
      ];

      const result = extractAssistantAnswer(output);

      expect(result).toBe("Assistant response.");
    });

    test("filters out non-assistant messages", () => {
      const output: ResponseOutputItem[] = [
        {
          type: "message",
          role: "user",
          status: "completed",
          content: [
            {
              type: "output_text",
              text: "User message.",
            },
          ],
        } as unknown as ResponseOutputMessage,
        {
          type: "message",
          role: "assistant",
          status: "completed",
          content: [
            {
              type: "output_text",
              text: "Assistant response.",
            },
          ],
        } as ResponseOutputMessage,
      ];

      const result = extractAssistantAnswer(output);

      expect(result).toBe("Assistant response.");
    });

    test("filters out non-completed messages", () => {
      const output: ResponseOutputItem[] = [
        {
          type: "message",
          role: "assistant",
          status: "in_progress",
          content: [
            {
              type: "output_text",
              text: "Incomplete response.",
            },
          ],
        } as ResponseOutputMessage,
        {
          type: "message",
          role: "assistant",
          status: "completed",
          content: [
            {
              type: "output_text",
              text: "Complete response.",
            },
          ],
        } as ResponseOutputMessage,
      ];

      const result = extractAssistantAnswer(output);

      expect(result).toBe("Complete response.");
    });

    test("filters out non-text content", () => {
      const output: ResponseOutputItem[] = [
        {
          type: "message",
          role: "assistant",
          status: "completed",
          content: [
            {
              type: "image",
              url: "https://example.com/image.jpg",
            } as unknown as ResponseOutputItem,
            {
              type: "output_text",
              text: "Text content.",
            },
          ],
        } as ResponseOutputMessage,
      ];

      const result = extractAssistantAnswer(output);

      expect(result).toBe("Text content.");
    });

    test("handles empty output array", () => {
      const output: ResponseOutputItem[] = [];

      const result = extractAssistantAnswer(output);

      expect(result).toBe("");
    });

    test("handles multiple assistant messages", () => {
      const output: ResponseOutputItem[] = [
        {
          type: "message",
          role: "assistant",
          status: "completed",
          content: [
            {
              type: "output_text",
              text: "First message.",
            },
          ],
        } as ResponseOutputMessage,
        {
          type: "message",
          role: "assistant",
          status: "completed",
          content: [
            {
              type: "output_text",
              text: "Second message.",
            },
          ],
        } as ResponseOutputMessage,
      ];

      const result = extractAssistantAnswer(output);

      expect(result).toBe("First message.\n\nSecond message.");
    });

    test("handles messages with no text content", () => {
      const output: ResponseOutputItem[] = [
        {
          type: "message",
          role: "assistant",
          status: "completed",
          content: [],
          id: "mock-id",
        } as ResponseOutputMessage,
      ];

      const result = extractAssistantAnswer(output);

      expect(result).toBe("");
    });

    test("handles messages with mixed content types", () => {
      const output: ResponseOutputItem[] = [
        {
          type: "message",
          role: "assistant",
          status: "completed",
          content: [
            {
              type: "tool_call",
              id: "call_123",
            } as unknown as ResponseOutputItem,
            {
              type: "output_text",
              text: "Text after tool call.",
            },
            {
              type: "image",
              url: "https://example.com/image.jpg",
            } as unknown as ResponseOutputItem,
            {
              type: "output_text",
              text: "Text after image.",
            },
          ],
        } as ResponseOutputMessage,
      ];

      const result = extractAssistantAnswer(output);

      expect(result).toBe("Text after tool call.\n\nText after image.");
    });
  });
});
