import { describe, expect, it } from 'vitest';

import {
  ANSWER_QUESTION_PROMPT,
  DEFINE_TAGS_PROMPT,
  PREPROCESS_QUESTION_PROMPT,
  PROMPTS,
} from './prompts';

describe('prompts', () => {
  it('should export all prompt constants', () => {
    expect(DEFINE_TAGS_PROMPT).toBeDefined();
    expect(PREPROCESS_QUESTION_PROMPT).toBeDefined();
    expect(ANSWER_QUESTION_PROMPT).toBeDefined();
  });

  it('should have PROMPTS object with all keys', () => {
    expect(PROMPTS.defineTags).toBe(DEFINE_TAGS_PROMPT);
    expect(PROMPTS.preprocessQuestion).toBe(PREPROCESS_QUESTION_PROMPT);
    expect(PROMPTS.answerQuestion).toBe(ANSWER_QUESTION_PROMPT);
  });

  it('should contain expected content in defineTags', () => {
    expect(PROMPTS.defineTags).toContain('customer_obsession');
    expect(PROMPTS.defineTags).toContain('frontend_architecture');
    expect(PROMPTS.defineTags).toContain('lowercase');
  });

  it('should contain expected content in preprocessQuestion', () => {
    expect(PROMPTS.preprocessQuestion).toContain('is_valid');
    expect(PROMPTS.preprocessQuestion).toContain('JSON format');
  });

  it('should contain expected content in answerQuestion', () => {
    expect(PROMPTS.answerQuestion).toContain('Li Xu');
    expect(PROMPTS.answerQuestion).toContain('first person');
  });

  it('should have correct types', () => {
    // Type checks
    const key: keyof typeof PROMPTS = 'defineTags';
    expect(PROMPTS[key]).toBe(DEFINE_TAGS_PROMPT);
  });
});
