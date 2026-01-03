import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, beforeEach, vi } from 'vitest';

import { ModeToggle } from './ModeToggler';

describe('ModeToggle', () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.classList.remove('dark');

    // Setup matchMedia mock
    window.matchMedia = vi.fn().mockImplementation((query) => ({
      matches: false,
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }));
  });

  it('should render the theme toggle button', () => {
    render(<ModeToggle />);
    expect(screen.getByRole('button')).toBeInTheDocument();
  });

  it('should have accessible label', () => {
    render(<ModeToggle />);
    expect(screen.getByText('Toggle theme')).toBeInTheDocument();
  });

  it('should open dropdown menu on click', async () => {
    const user = userEvent.setup();
    render(<ModeToggle />);

    const button = screen.getByRole('button');
    await user.click(button);

    await waitFor(() => {
      expect(screen.getByText('Light')).toBeInTheDocument();
      expect(screen.getByText('Dark')).toBeInTheDocument();
      expect(screen.getByText('System')).toBeInTheDocument();
    });
  });

  it('should switch to light mode when Light is clicked', async () => {
    const user = userEvent.setup();
    render(<ModeToggle />);

    const button = screen.getByRole('button');
    await user.click(button);

    const lightOption = screen.getByText('Light');
    await user.click(lightOption);

    await waitFor(() => {
      expect(localStorage.getItem('theme-preference')).toBe('light');
      expect(document.documentElement.classList.contains('dark')).toBe(false);
    });
  });

  it('should switch to dark mode when Dark is clicked', async () => {
    const user = userEvent.setup();
    render(<ModeToggle />);

    const button = screen.getByRole('button');
    await user.click(button);

    const darkOption = screen.getByText('Dark');
    await user.click(darkOption);

    await waitFor(() => {
      expect(localStorage.getItem('theme-preference')).toBe('dark');
      expect(document.documentElement.classList.contains('dark')).toBe(true);
    });
  });

  it('should switch to system mode when System is clicked', async () => {
    const user = userEvent.setup();
    localStorage.setItem('theme-preference', 'light');

    render(<ModeToggle />);

    const button = screen.getByRole('button');
    await user.click(button);

    const systemOption = screen.getByText('System');
    await user.click(systemOption);

    await waitFor(() => {
      expect(localStorage.getItem('theme-preference')).toBeNull();
    });
  });

  it('should initialize with stored theme preference', async () => {
    localStorage.setItem('theme-preference', 'dark');

    render(<ModeToggle />);

    await waitFor(() => {
      expect(document.documentElement.classList.contains('dark')).toBe(true);
    });
  });

  it('should install system theme listener on mount', () => {
    const addEventListenerSpy = vi.fn();
    window.matchMedia = vi.fn().mockReturnValue({
      matches: false,
      media: '(prefers-color-scheme: dark)',
      addEventListener: addEventListenerSpy,
      removeEventListener: vi.fn(),
    });

    render(<ModeToggle />);

    expect(addEventListenerSpy).toHaveBeenCalledWith(
      'change',
      expect.any(Function)
    );
  });

  it('should cleanup listener on unmount', () => {
    const removeEventListenerSpy = vi.fn();
    window.matchMedia = vi.fn().mockReturnValue({
      matches: false,
      media: '(prefers-color-scheme: dark)',
      addEventListener: vi.fn(),
      removeEventListener: removeEventListenerSpy,
    });

    const { unmount } = render(<ModeToggle />);
    unmount();

    expect(removeEventListenerSpy).toHaveBeenCalledWith(
      'change',
      expect.any(Function)
    );
  });
});
