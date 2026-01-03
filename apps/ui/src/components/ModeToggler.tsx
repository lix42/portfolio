import {
  LaptopPhoneSyncIcon,
  Moon01Icon,
  Sun02Icon,
} from '@hugeicons/core-free-icons';
import { HugeiconsIcon } from '@hugeicons/react';
import { useCallback, useEffect, useState } from 'react';

import { Button } from '~/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '~/components/ui/dropdown-menu';
import {
  applyTheme,
  getThemePreference,
  installSystemThemeListener,
  setTheme,
  ThemePreference,
} from '~/lib/themeMode';

const ssrIcon = (
  <>
    <HugeiconsIcon
      icon={Sun02Icon}
      className="size-5 scale-100 rotate-0 transition-all dark:scale-0 dark:-rotate-90"
    />
    <HugeiconsIcon
      icon={Moon01Icon}
      className="absolute size-5 scale-0 rotate-90 transition-all dark:scale-100 dark:rotate-0"
    />
  </>
);

const preferModeToIconMap: Record<ThemePreference, React.ReactNode> = {
  light: <HugeiconsIcon icon={Sun02Icon} className="size-5" />,
  dark: <HugeiconsIcon icon={Moon01Icon} className="size-5" />,
  system: <HugeiconsIcon icon={LaptopPhoneSyncIcon} className="size-5" />,
};

export function ModeToggle() {
  const [preferMode, setPreferMode] = useState<ThemePreference>();

  const updatePreferMode = useCallback((mode: ThemePreference) => {
    setPreferMode(mode);
    setTheme(mode);
  }, []);

  useEffect(() => {
    setPreferMode(getThemePreference());
    applyTheme();
    return installSystemThemeListener();
  }, []);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon">
          {preferMode ? preferModeToIconMap[preferMode] : ssrIcon}
          <span className="sr-only">Toggle theme</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => updatePreferMode('light')}>
          Light
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => updatePreferMode('dark')}>
          Dark
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => updatePreferMode('system')}>
          System
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
