import { describe, expect, it } from 'vitest';

import { cn } from './utils';

describe('cn utility function', () => {
  it('should merge class names correctly', () => {
    expect(cn('foo', 'bar')).toBe('foo bar');
  });

  it('should merge Tailwind classes and resolve conflicts', () => {
    // twMerge should handle conflicts - later classes override earlier ones
    expect(cn('px-2', 'px-4')).toBe('px-4');
  });

  it('should handle arrays of class names', () => {
    expect(cn(['foo', 'bar'], 'baz')).toBe('foo bar baz');
  });

  it('should handle objects with boolean values', () => {
    expect(cn({ foo: true, bar: false, baz: true })).toBe('foo baz');
  });

  it('should handle undefined and null values', () => {
    expect(cn('foo', undefined, null, 'bar')).toBe('foo bar');
  });

  it('should handle empty input', () => {
    expect(cn()).toBe('');
  });

  it('should handle complex combination of inputs', () => {
    expect(
      cn('base-class', { active: true, disabled: false }, ['extra', 'classes'])
    ).toBe('base-class active extra classes');
  });
});
