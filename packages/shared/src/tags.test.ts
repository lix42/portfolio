import { describe, it, expect } from 'vitest';

import { parseTags, normalizeTag } from './tags';

describe('tags', () => {
  describe('parseTags', () => {
    it('should parse JSON array', () => {
      const response = '["ownership", "frontend_architecture", "testing"]';
      const tags = parseTags(response);

      expect(tags).toEqual(['ownership', 'frontend_architecture', 'testing']);
    });

    it('should parse comma-separated tags', () => {
      const response = 'ownership, frontend_architecture, testing';
      const tags = parseTags(response);

      expect(tags).toContain('ownership');
      expect(tags).toContain('frontend_architecture');
      expect(tags).toContain('testing');
    });

    it('should parse newline-separated tags', () => {
      const response = '- ownership\n- frontend_architecture\n- testing';
      const tags = parseTags(response);

      expect(tags).toContain('ownership');
      expect(tags).toContain('frontend_architecture');
    });

    it('should limit to 5 tags', () => {
      const response = 'tag1, tag2, tag3, tag4, tag5, tag6, tag7';
      const tags = parseTags(response);

      expect(tags.length).toBeLessThanOrEqual(5);
    });

    it('should normalize tags', () => {
      const response = 'Ownership, Frontend Architecture, Testing!';
      const tags = parseTags(response);

      expect(tags).toContain('ownership');
      expect(tags).toContain('frontend_architecture');
      expect(tags).toContain('testing');
    });
  });

  describe('normalizeTag', () => {
    it('should convert to lowercase', () => {
      expect(normalizeTag('Ownership')).toBe('ownership');
      expect(normalizeTag('FRONTEND')).toBe('frontend');
    });

    it('should replace spaces with underscores', () => {
      expect(normalizeTag('frontend architecture')).toBe(
        'frontend_architecture'
      );
      expect(normalizeTag('system design')).toBe('system_design');
    });

    it('should remove special characters', () => {
      expect(normalizeTag('testing!')).toBe('testing');
      expect(normalizeTag('owner$hip')).toBe('ownerhip'); // $ is removed
      expect(normalizeTag('tag-name')).toBe('tagname');
      expect(normalizeTag('front@end')).toBe('frontend'); // @ is removed
    });

    it('should handle multiple spaces', () => {
      expect(normalizeTag('frontend   architecture')).toBe(
        'frontend_architecture'
      );
    });
  });
});
