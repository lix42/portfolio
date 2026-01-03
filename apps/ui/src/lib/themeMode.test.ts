import { describe, it, expect, beforeEach, vi } from 'vitest';

import {
  getThemePreference,
  getEffectiveTheme,
  applyTheme,
  setTheme,
  installSystemThemeListener,
} from './themeMode';

describe('themeMode', () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.classList.remove('dark');
  });

  describe('getThemePreference', () => {
    it('should return "light" when localStorage has "light"', () => {
      localStorage.setItem('theme-preference', 'light');
      expect(getThemePreference()).toBe('light');
    });

    it('should return "dark" when localStorage has "dark"', () => {
      localStorage.setItem('theme-preference', 'dark');
      expect(getThemePreference()).toBe('dark');
    });

    it('should return "system" when localStorage is empty', () => {
      expect(getThemePreference()).toBe('system');
    });

    it('should return "system" when localStorage has invalid value', () => {
      localStorage.setItem('theme-preference', 'invalid');
      expect(getThemePreference()).toBe('system');
    });
  });

  describe('getEffectiveTheme', () => {
    it('should return "light" when preference is "light"', () => {
      expect(getEffectiveTheme('light')).toBe('light');
    });

    it('should return "dark" when preference is "dark"', () => {
      expect(getEffectiveTheme('dark')).toBe('dark');
    });

    it('should return system preference when preference is "system"', () => {
      const mockMatchMedia = vi.fn().mockImplementation((query) => ({
        matches: query === '(prefers-color-scheme: dark)',
        media: query,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      }));
      window.matchMedia = mockMatchMedia;

      expect(getEffectiveTheme('system')).toBe('dark');

      // Test light system preference
      mockMatchMedia.mockImplementation((query) => ({
        matches: false,
        media: query,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      }));
      expect(getEffectiveTheme('system')).toBe('light');
    });

    it('should use stored preference when no parameter provided', () => {
      localStorage.setItem('theme-preference', 'dark');
      expect(getEffectiveTheme()).toBe('dark');
    });
  });

  describe('applyTheme', () => {
    it('should add "dark" class when theme is dark', () => {
      applyTheme('dark');
      expect(document.documentElement.classList.contains('dark')).toBe(true);
    });

    it('should not add "dark" class when theme is light', () => {
      applyTheme('light');
      expect(document.documentElement.classList.contains('dark')).toBe(false);
    });

    it('should apply system preference when preference is "system"', () => {
      const mockMatchMedia = vi.fn().mockImplementation((query) => ({
        matches: query === '(prefers-color-scheme: dark)',
        media: query,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      }));
      window.matchMedia = mockMatchMedia;

      applyTheme('system');
      expect(document.documentElement.classList.contains('dark')).toBe(true);
    });

    it('should use stored preference when no parameter provided', () => {
      localStorage.setItem('theme-preference', 'dark');
      applyTheme();
      expect(document.documentElement.classList.contains('dark')).toBe(true);
    });
  });

  describe('setTheme', () => {
    it('should save "light" to localStorage and apply it', () => {
      setTheme('light');
      expect(localStorage.getItem('theme-preference')).toBe('light');
      expect(document.documentElement.classList.contains('dark')).toBe(false);
    });

    it('should save "dark" to localStorage and apply it', () => {
      setTheme('dark');
      expect(localStorage.getItem('theme-preference')).toBe('dark');
      expect(document.documentElement.classList.contains('dark')).toBe(true);
    });

    it('should remove localStorage key when set to "system"', () => {
      localStorage.setItem('theme-preference', 'light');
      setTheme('system');
      expect(localStorage.getItem('theme-preference')).toBeNull();
    });
  });

  describe('installSystemThemeListener', () => {
    it('should add event listener to matchMedia', () => {
      const addEventListenerSpy = vi.fn();
      const removeEventListenerSpy = vi.fn();

      window.matchMedia = vi.fn().mockReturnValue({
        matches: false,
        media: '(prefers-color-scheme: dark)',
        addEventListener: addEventListenerSpy,
        removeEventListener: removeEventListenerSpy,
      });

      const cleanup = installSystemThemeListener();

      expect(addEventListenerSpy).toHaveBeenCalledWith(
        'change',
        expect.any(Function)
      );

      cleanup();

      expect(removeEventListenerSpy).toHaveBeenCalledWith(
        'change',
        expect.any(Function)
      );
    });

    it('should update theme when system preference changes and preference is "system"', () => {
      let changeHandler: (() => void) | null = null;

      window.matchMedia = vi.fn().mockReturnValue({
        matches: true,
        media: '(prefers-color-scheme: dark)',
        addEventListener: vi.fn((_event, handler) => {
          changeHandler = handler as () => void;
        }),
        removeEventListener: vi.fn(),
      });

      localStorage.removeItem('theme-preference'); // Ensure system mode
      installSystemThemeListener();

      // Trigger the change event
      expect(changeHandler).not.toBeNull();
      changeHandler!();

      expect(document.documentElement.classList.contains('dark')).toBe(true);
    });
  });
});
