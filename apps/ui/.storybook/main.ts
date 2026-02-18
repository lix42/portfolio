import type { StorybookConfig } from "@storybook/react-vite";
import tailwindcss from "@tailwindcss/vite";
import tsconfigPaths from "vite-tsconfig-paths";

const config: StorybookConfig = {
  framework: "@storybook/react-vite",
  stories: ["../src/**/*.stories.@(ts|tsx)"],
  addons: ["@storybook/addon-docs"],
  viteFinal: async (config) => {
    config.plugins = [
      // Exclude SSR/deploy-only plugins — they require a Cloudflare Workers
      // runtime context that isn't available in Storybook's Vite dev server.
      ...(config.plugins ?? []).filter((p) => {
        if (!p || typeof p !== "object" || !("name" in p)) return true;
        const name = (p as { name: string }).name;
        return !name.includes("cloudflare") && !name.includes("tanstack-start");
      }),
      tailwindcss(),
      tsconfigPaths({ projects: ["./tsconfig.json"] }),
    ];
    return config;
  },
};

export default config;
