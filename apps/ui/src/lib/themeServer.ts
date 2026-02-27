import { createServerFn } from "@tanstack/react-start";
import { getCookie } from "@tanstack/react-start/server";
import { THEME_COOKIE_NAME } from "./constants";
import type { EffectiveTheme } from "./themeMode";

export const getServerTheme = createServerFn({ method: "GET" }).handler(
  (): EffectiveTheme | null => {
    const value = getCookie(THEME_COOKIE_NAME);
    if (value === "dark" || value === "light") return value;
    return null;
  },
);
