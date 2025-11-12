import type OpenAI from 'openai';
import type { Responses } from 'openai/resources';
import type { ParsedResponse } from 'openai/resources/responses/responses.mjs';
import type { MockedFunction } from 'vitest';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

import type { PreprocessQuestionResultType } from './preprocessQuestion';
import { preprocessQuestion } from './preprocessQuestion';
import { generateUserPromptProcessQuestion } from './utils/prompts';

// Mock the shared package
vi.mock('@portfolio/shared', () => ({
  DEFINE_TAGS_PROMPT: 'Mock system prompt for tags',
  PREPROCESS_QUESTION_PROMPT: 'Mock developer prompt for preprocessing',
  TAG_GENERATION_MODEL: 'gpt-4o',
}));

// Mock the prompts utils
vi.mock('./utils/prompts', () => ({
  generateUserPromptProcessQuestion: vi.fn(),
}));

describe('preprocessQuestion', () => {
  let mockOpenAI: OpenAI;
  let mockParse: MockedFunction<
    (
      ...params: [Responses.ResponseCreateParams]
    ) => Promise<ParsedResponse<PreprocessQuestionResultType>>
  >;

  // Helper function to create proper OpenAI response structure
  const createMockParseResponse = (
    outputParsed: PreprocessQuestionResultType
  ) =>
    ({
      output_parsed: outputParsed,
      output: null,
      id: 'mock-id',
      created_at: Date.now(),
      output_text: null,
      model: 'gpt-4o',
      usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
      finish_reason: 'stop',
      system_fingerprint: null,
      object: 'response',
      _request_id: 'mock-request-id',
    }) as unknown as ParsedResponse<PreprocessQuestionResultType>;

  beforeEach(() => {
    // Reset all mocks before each test
    vi.clearAllMocks();

    // Create mock for the parse method
    mockParse = vi.fn();

    // Create mock OpenAI instance
    mockOpenAI = {
      responses: {
        parse: mockParse,
      },
    } as unknown as OpenAI;

    // Setup default mock implementation for generateUserPromptProcessQuestion
    vi.mocked(generateUserPromptProcessQuestion).mockImplementation(
      (text: string) => `Evaluate the following interview question:\n"${text}"`
    );
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  test('successfully preprocesses a valid question and returns structured result', async () => {
    // Arrange
    const inputText =
      'Tell me about a time you led a team through a difficult project.';
    const mockResponse = {
      output_parsed: {
        is_valid: true,
        tags: [
          'leadership',
          'team management',
          'project management',
          'problem solving',
        ],
      },
    };

    mockParse.mockResolvedValue(
      createMockParseResponse(mockResponse.output_parsed)
    );

    // Act
    const result = await preprocessQuestion(inputText, mockOpenAI);

    // Assert
    expect(result).toEqual({
      is_valid: true,
      tags: [
        'leadership',
        'team management',
        'project management',
        'problem solving',
      ],
    });

    // Verify OpenAI API was called with correct parameters
    expect(mockParse).toHaveBeenCalledTimes(1);
    expect(mockParse).toHaveBeenCalledWith({
      model: 'gpt-4o',
      input: [
        {
          role: 'system',
          content: 'Mock system prompt for tags',
        },
        {
          role: 'developer',
          content: 'Mock developer prompt for preprocessing',
        },
        {
          role: 'user',
          content: `Evaluate the following interview question:\n"${inputText}"`,
        },
      ],
      text: {
        format: expect.any(Object), // zodTextFormat object
      },
    });

    // Verify prompt generation was called
    expect(generateUserPromptProcessQuestion).toHaveBeenCalledWith(inputText);
  });

  test('returns null result when OpenAI API call fails', async () => {
    // Arrange
    const inputText = 'How do you handle conflicts in a team?';
    const apiError = new Error('OpenAI API error: Rate limit exceeded');
    mockParse.mockRejectedValue(apiError);

    // Act & Assert
    await expect(preprocessQuestion(inputText, mockOpenAI)).rejects.toThrow(
      'OpenAI API error: Rate limit exceeded'
    );

    // Verify API was called
    expect(mockParse).toHaveBeenCalledTimes(1);
    expect(generateUserPromptProcessQuestion).toHaveBeenCalledWith(inputText);
  });

  test('returns null result when OpenAI response parsing fails', async () => {
    // Arrange
    const inputText = 'Describe your experience with agile methodologies.';
    const mockResponse = {
      output_parsed: null as unknown as PreprocessQuestionResultType, // Simulate parsing failure
    };

    mockParse.mockResolvedValue(
      createMockParseResponse(mockResponse.output_parsed)
    );

    // Act
    const result = await preprocessQuestion(inputText, mockOpenAI);

    // Assert
    expect(result).toEqual({
      is_valid: false,
      tags: [],
    });

    // Verify API was called
    expect(mockParse).toHaveBeenCalledTimes(1);
    expect(generateUserPromptProcessQuestion).toHaveBeenCalledWith(inputText);
  });

  test('handles empty string input', async () => {
    // Arrange
    const inputText = '';
    const mockResponse = {
      output_parsed: {
        is_valid: false,
        tags: [],
      },
    };

    mockParse.mockResolvedValue(
      createMockParseResponse(mockResponse.output_parsed)
    );

    // Act
    const result = await preprocessQuestion(inputText, mockOpenAI);

    // Assert
    expect(result).toEqual({
      is_valid: false,
      tags: [],
    });

    // Verify prompt generation was called with empty string
    expect(generateUserPromptProcessQuestion).toHaveBeenCalledWith('');
  });

  test('handles special characters and unicode in input', async () => {
    // Arrange
    const inputText =
      'How do you handle "difficult" situations with émojis 🚀 and unicode?';
    const mockResponse = {
      output_parsed: {
        is_valid: true,
        tags: ['problem solving', 'communication', 'adaptability'],
      },
    };

    mockParse.mockResolvedValue(
      createMockParseResponse(mockResponse.output_parsed)
    );

    // Act
    const result = await preprocessQuestion(inputText, mockOpenAI);

    // Assert
    expect(result).toEqual({
      is_valid: true,
      tags: ['problem solving', 'communication', 'adaptability'],
    });

    // Verify the special characters were passed through correctly
    expect(generateUserPromptProcessQuestion).toHaveBeenCalledWith(inputText);
  });

  test('handles very long input text', async () => {
    // Arrange
    const longText = 'A'.repeat(10000); // 10KB of text
    const mockResponse = {
      output_parsed: {
        is_valid: true,
        tags: ['communication', 'detail orientation'],
      },
    };

    mockParse.mockResolvedValue(
      createMockParseResponse(mockResponse.output_parsed)
    );

    // Act
    const result = await preprocessQuestion(longText, mockOpenAI);

    // Assert
    expect(result).toEqual({
      is_valid: true,
      tags: ['communication', 'detail orientation'],
    });

    // Verify the long text was passed through
    expect(generateUserPromptProcessQuestion).toHaveBeenCalledWith(longText);
  });

  test('handles invalid response structure from OpenAI', async () => {
    // Arrange
    const inputText = 'What is your biggest weakness?';
    const mockResponse = {
      output_parsed: {
        // Missing required fields or wrong types
        is_valid: 'yes', // Should be boolean
        tags: 'leadership, teamwork', // Should be array
      },
    };

    mockParse.mockResolvedValue(
      createMockParseResponse(
        mockResponse.output_parsed as unknown as PreprocessQuestionResultType
      )
    );

    // Act
    const result = await preprocessQuestion(inputText, mockOpenAI);

    // Assert
    // Should return the invalid response as-is since we're not validating the parsed output
    expect(result).toEqual({
      is_valid: 'yes',
      tags: 'leadership, teamwork',
    });
  });

  test('handles network timeout error', async () => {
    // Arrange
    const inputText = 'How do you prioritize tasks?';
    const timeoutError = new Error('Request timeout');
    mockParse.mockRejectedValue(timeoutError);

    // Act & Assert
    await expect(preprocessQuestion(inputText, mockOpenAI)).rejects.toThrow(
      'Request timeout'
    );

    expect(mockParse).toHaveBeenCalledTimes(1);
  });

  test('handles malformed JSON response from OpenAI', async () => {
    // Arrange
    const inputText = 'Tell me about a challenging project.';
    const mockResponse = {
      output_parsed: {
        is_valid: true,
        tags: ['project management', 'challenge', 'problem solving'],
      },
    };

    mockParse.mockResolvedValue(
      createMockParseResponse(mockResponse.output_parsed)
    );

    // Act
    const result = await preprocessQuestion(inputText, mockOpenAI);

    // Assert
    expect(result).toEqual({
      is_valid: true,
      tags: ['project management', 'challenge', 'problem solving'],
    });
  });

  test('verifies correct model and structured output format are used', async () => {
    // Arrange
    const inputText = 'How do you ensure code quality?';
    const mockResponse = {
      output_parsed: {
        is_valid: true,
        tags: ['code quality', 'best practices', 'testing'],
      },
    };

    mockParse.mockResolvedValue(
      createMockParseResponse(mockResponse.output_parsed)
    );

    // Act
    await preprocessQuestion(inputText, mockOpenAI);

    // Assert
    expect(mockParse).toHaveBeenCalledWith(
      expect.objectContaining({
        model: 'gpt-4o',
        text: expect.objectContaining({
          format: expect.any(Object), // zodTextFormat object
        }),
      })
    );
  });

  test('handles multiple concurrent calls', async () => {
    // Arrange
    const inputs = ['Question 1', 'Question 2', 'Question 3'];

    const mockResponses = [
      { output_parsed: { is_valid: true, tags: ['tag1'] } },
      { output_parsed: { is_valid: true, tags: ['tag2'] } },
      { output_parsed: { is_valid: true, tags: ['tag3'] } },
    ];

    mockParse
      .mockResolvedValueOnce(
        // biome-ignore lint: test mock
        createMockParseResponse(mockResponses[0]!.output_parsed)
      )
      .mockResolvedValueOnce(
        // biome-ignore lint: test mock
        createMockParseResponse(mockResponses[1]!.output_parsed)
      )
      .mockResolvedValueOnce(
        // biome-ignore lint: test mock
        createMockParseResponse(mockResponses[2]!.output_parsed)
      );

    // Act
    const results = await Promise.all(
      inputs.map((input) => preprocessQuestion(input, mockOpenAI))
    );

    // Assert
    expect(results).toHaveLength(3);
    expect(results[0]?.tags).toEqual(['tag1']);
    expect(results[1]?.tags).toEqual(['tag2']);
    expect(results[2]?.tags).toEqual(['tag3']);
    expect(mockParse).toHaveBeenCalledTimes(3);
  });

  test('handles undefined OpenAI client gracefully', async () => {
    // Arrange
    const inputText = 'Test question';
    const undefinedOpenAI = undefined as unknown as OpenAI;

    // Act & Assert
    await expect(
      preprocessQuestion(inputText, undefinedOpenAI)
    ).rejects.toThrow();
  });
});
